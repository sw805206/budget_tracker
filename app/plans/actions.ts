"use server";

// Plan wizard server actions (Create-New, Steps 1–2).
// Step 1 persists a Draft Plan + PlanVersion early (persist-as-Draft-early).
// Step 2 validates and writes the plan-level structural selections and the
// version-level parameters + allocations, re-checking server-side.

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import {
  WF001_IDENTITY,
  PLAN_FORKS,
  STEP_WAREHOUSE,
  STEP_DELIVERY,
  HORIZON_MIN,
  HORIZON_MAX,
  type TargetCashMode,
} from "./constants";

export type CreateResult =
  | { ok: true; planId: string; planVersionId: string }
  | { ok: false; error: string };

export type SaveResult = { ok: true } | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/;
const startMonthIsJan = (s: string) => s.slice(5, 7) === "01";

// ── Step 1: create the Draft Plan + PlanVersion (atomic nested create) ────────
export async function createDraftPlan(input: {
  name: string;
  startMonth: string;
}): Promise<CreateResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "File name is required." };
  if (!YYYY_MM.test(input.startMonth))
    return { ok: false, error: "Start month must be yyyy-mm." };

  const plan = await prisma.plan.create({
    data: {
      ...WF001_IDENTITY,
      versions: {
        create: { name, startMonth: input.startMonth, status: "Draft" },
      },
    },
    include: { versions: true },
  });
  revalidatePath("/plans");
  return { ok: true, planId: plan.id, planVersionId: plan.versions[0].id };
}

// Step 1 re-save (user went Back and edited name/start month before re-advancing).
export async function updatePlanMeta(
  planVersionId: string,
  input: { name: string; startMonth: string },
): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "File name is required." };
  if (!YYYY_MM.test(input.startMonth))
    return { ok: false, error: "Start month must be yyyy-mm." };
  await prisma.planVersion.update({
    where: { id: planVersionId },
    data: { name, startMonth: input.startMonth },
  });
  revalidatePath("/plans");
  return { ok: true };
}

// ── Step 2: parameters + structural selections + allocations ──────────────────
export type PlanParamsInput = {
  horizonX: number;
  warehouseSelections: string[];
  deliverySelections: string[];
  beginningCash: number;
  targetCashValue: number;
  targetCashMode: TargetCashMode;
  // allocations only for a fork with >1 selection; { flow, percentage } per selected flow
  warehouseAllocations: { flow: string; percentage: number }[];
  deliveryAllocations: { flow: string; percentage: number }[];
};

function optionsFor(step: string): readonly string[] {
  return PLAN_FORKS.find((f) => f.step === step)?.options ?? [];
}

// Validate one fork's selections + allocations. Returns an error message or null.
function validateFork(
  step: string,
  selections: string[],
  allocations: { flow: string; percentage: number }[],
): string | null {
  const valid = optionsFor(step);
  if (selections.length < 1) return `Select at least one ${step} option.`;
  for (const s of selections)
    if (!valid.includes(s)) return `Unknown ${step} option: ${s}.`;
  if (selections.length > 1) {
    // allocation required, must cover exactly the selected flows and sum to 100
    const allocFlows = allocations.map((a) => a.flow).sort();
    const selSorted = [...selections].sort();
    if (
      allocFlows.length !== selSorted.length ||
      allocFlows.some((f, i) => f !== selSorted[i])
    )
      return `${step}: allocation must cover each selected flow.`;
    const sum = allocations.reduce((n, a) => n + a.percentage, 0);
    if (Math.round(sum) !== 100)
      return `${step}: allocation must total 100% (currently ${sum}%).`;
  }
  return null;
}

// ── Delete a PlanVersion (BL-021, plans-list delete) ──────────────────────────
// Lifecycle (Published/Draft, delete, copy, resume) is PlanVersion-level per the
// BRD (DATASET §2/§3): the Plan is the fixed workflow card and is NEVER the delete
// target. Deleting the version cascades to that version's OWN children only
// (allocations, revenue, seasonality, cost lines, outputs — all ON DELETE CASCADE);
// the Plan and its plan-level PlanStepSelection rows survive untouched, even when
// this was the Plan's last version (a version-less Plan is a valid, permanent card).
// No reference gate: a plan version owns its children outright — nothing to guard.
export async function deletePlanVersion(
  planVersionId: string,
): Promise<DeleteResult> {
  try {
    await prisma.planVersion.delete({ where: { id: planVersionId } });
  } catch {
    return { ok: false, error: "Could not delete this plan. Please try again." };
  }
  revalidatePath("/plans");
  return { ok: true };
}

// ── Resume: persist wizard step + load a Draft back into the wizard (BL-019) ─────

// Single writer for PlanVersion.lastStep. Called ONLY from the wizard's step-change
// effect (never from the CRUD actions) — one choke-point so a future navigation path
// cannot silently skip the write. Best-effort progress tracking: no revalidate (no
// list refetch needed), and failures are swallowed rather than shown to the user.
export async function updateLastStep(
  planVersionId: string,
  step: number,
): Promise<void> {
  if (!Number.isInteger(step) || step < 1 || step > 4) return;
  try {
    await prisma.planVersion.update({
      where: { id: planVersionId },
      data: { lastStep: step },
    });
  } catch {
    /* progress tracking is non-critical; never surface */
  }
}

export type ResumeData = {
  planVersionId: string;
  startStep: number; // lastStep ?? 1 (null = legacy Draft that predates the column)
  status: string;
  name: string;
  startMonth: string;
  horizonX: number;
  warehouseSelections: string[];
  deliverySelections: string[];
  beginningCash: string;
  targetCashValue: string;
  targetCashMode: TargetCashMode;
  allocations: Record<string, string>; // flow -> percent (string, for the number inputs)
};

// Loads a Draft's meta + Step-2 params so the wizard can reopen it WITHOUT creating a
// new plan and WITHOUT rendering defaults (which a Save would persist over real data).
// Deliberately does NOT read revenue/seasonality rows: Step 3 (RevenueStep) self-loads
// those via getRevenueData(planVersionId). Keeping the two loaders on disjoint data
// avoids a double-fetch/race on the same revenue rows.
export async function getResumeData(
  planVersionId: string,
): Promise<ResumeData | null> {
  const pv = await prisma.planVersion.findUnique({
    where: { id: planVersionId },
    include: {
      plan: { include: { stepSelections: true } },
      allocations: true,
    },
  });
  if (!pv) return null;

  const warehouseSelections = pv.plan.stepSelections
    .filter((s) => s.step === STEP_WAREHOUSE)
    .map((s) => s.option);
  const deliverySelections = pv.plan.stepSelections
    .filter((s) => s.step === STEP_DELIVERY)
    .map((s) => s.option);

  const allocations: Record<string, string> = {};
  for (const a of pv.allocations) allocations[a.flow] = String(Number(a.percentage));

  return {
    planVersionId: pv.id,
    startStep: pv.lastStep ?? 1,
    status: pv.status,
    name: pv.name,
    startMonth: pv.startMonth,
    horizonX: pv.horizonX,
    warehouseSelections,
    deliverySelections,
    beginningCash: String(Number(pv.beginningCash)),
    targetCashValue: String(Number(pv.targetCashValue)),
    targetCashMode: pv.targetCashMode as TargetCashMode,
    allocations,
  };
}

export async function savePlanParameters(
  planVersionId: string,
  input: PlanParamsInput,
): Promise<SaveResult> {
  const pv = await prisma.planVersion.findUnique({
    where: { id: planVersionId },
    select: { startMonth: true, planId: true },
  });
  if (!pv) return { ok: false, error: "Plan version not found." };

  // Horizon (WORKFLOW §3.4 / DATASET §3.2)
  if (
    !Number.isInteger(input.horizonX) ||
    input.horizonX < HORIZON_MIN ||
    input.horizonX > HORIZON_MAX
  )
    return { ok: false, error: `Horizon must be a whole number ${HORIZON_MIN}–${HORIZON_MAX}.` };
  if (!startMonthIsJan(pv.startMonth) && input.horizonX === 0)
    return { ok: false, error: "you don't have a full year" };

  // Forks
  const whErr = validateFork(STEP_WAREHOUSE, input.warehouseSelections, input.warehouseAllocations);
  if (whErr) return { ok: false, error: whErr };
  const dlErr = validateFork(STEP_DELIVERY, input.deliverySelections, input.deliveryAllocations);
  if (dlErr) return { ok: false, error: dlErr };

  // Build rows. Structural selections → plan-level; allocations (>1 only) → version-level.
  const stepRows = [
    ...input.warehouseSelections.map((option) => ({ planId: pv.planId, step: STEP_WAREHOUSE, option })),
    ...input.deliverySelections.map((option) => ({ planId: pv.planId, step: STEP_DELIVERY, option })),
  ];
  const allocRows = [
    ...(input.warehouseSelections.length > 1
      ? input.warehouseAllocations.map((a) => ({ planVersionId, step: STEP_WAREHOUSE, flow: a.flow, percentage: a.percentage }))
      : []),
    ...(input.deliverySelections.length > 1
      ? input.deliveryAllocations.map((a) => ({ planVersionId, step: STEP_DELIVERY, flow: a.flow, percentage: a.percentage }))
      : []),
  ];

  // Idempotent, atomic: update version fields, then wipe+rewrite selections/allocations.
  await prisma.$transaction([
    prisma.planVersion.update({
      where: { id: planVersionId },
      data: {
        horizonX: input.horizonX,
        beginningCash: input.beginningCash,
        targetCashValue: input.targetCashValue,
        targetCashMode: input.targetCashMode,
      },
    }),
    prisma.planStepSelection.deleteMany({ where: { planId: pv.planId } }),
    prisma.planStepSelection.createMany({ data: stepRows }),
    prisma.planVersionAllocation.deleteMany({ where: { planVersionId } }),
    prisma.planVersionAllocation.createMany({ data: allocRows }),
  ]);

  revalidatePath("/plans");
  revalidatePath(`/plans/${pv.planId}`);
  return { ok: true };
}
