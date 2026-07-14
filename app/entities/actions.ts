"use server";

// Entity CRUD server actions. This is the validation layer that enforces the
// entity-first "cannot save incomplete" rule (DATASET §4 / WORKFLOW §6) — the DB
// columns are nullable on purpose (inline-creation seam), so completeness is
// enforced HERE, not by NOT-NULL. Currency is written as the Ph1 USD default.

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { CURRENCY_DEFAULT } from "./constants";
import { getEntityReferences, isReferenced } from "./references";

export type EntityInput = {
  name: string;
  type: string;
  paymentFlow: string;
  paymentTermAnchor: string;
  paymentTermDays: string; // arrives from the form as a string
  tags: string;
  comments: string;
};

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Mandatory-field completeness check (the save gate). Returns an error message,
// or null when all mandatory fields are present.
function validateMandatory(input: EntityInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  if (!input.type) return "Type is required.";
  if (!input.paymentFlow) return "Payment Flow is required.";
  if (!input.paymentTermAnchor) return "Payment Term anchor is required.";
  const days = Number(input.paymentTermDays);
  if (input.paymentTermDays === "" || !Number.isInteger(days) || days < 0)
    return "Payment Term days must be a whole number (0 or more).";
  return null;
}

// Shared mapping from form input to the persisted columns.
function toData(input: EntityInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    paymentFlow: input.paymentFlow,
    paymentTermAnchor: input.paymentTermAnchor,
    paymentTermDays: Number(input.paymentTermDays),
    currency: CURRENCY_DEFAULT, // Ph1 default; not shown in the UI, never blocks
    tags: input.tags?.trim() ? input.tags.trim() : null,
    comments: input.comments?.trim() ? input.comments.trim() : null,
  };
}

export async function createEntity(input: EntityInput): Promise<ActionResult> {
  const error = validateMandatory(input);
  if (error) return { ok: false, error };
  const entity = await prisma.entity.create({ data: toData(input) });
  revalidatePath("/entities");
  return { ok: true, id: entity.id };
}

export async function updateEntity(
  id: string,
  input: EntityInput,
): Promise<ActionResult> {
  const error = validateMandatory(input);
  if (error) return { ok: false, error };
  await prisma.entity.update({ where: { id }, data: toData(input) });
  revalidatePath("/entities");
  revalidatePath(`/entities/${id}`);
  return { ok: true, id };
}

// ── Archive / Unarchive (BL-011) ─────────────────────────────────────────────
// Visibility-only. Archiving sets archivedAt = now; it does NOT alter any
// referencing plan's data (Published immutability preserved; no cascade).

export async function archiveEntity(id: string): Promise<ActionResult> {
  await prisma.entity.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/entities");
  revalidatePath(`/entities/${id}`);
  return { ok: true, id };
}

export async function unarchiveEntity(id: string): Promise<ActionResult> {
  await prisma.entity.update({ where: { id }, data: { archivedAt: null } });
  revalidatePath("/entities");
  revalidatePath(`/entities/${id}`);
  return { ok: true, id };
}

// ── Delete (BL-011) — gated hard delete ──────────────────────────────────────
// DELETE-SAFETY ASYMMETRY (see app/entities/references.ts): the three CLIENT
// tables (RevenueAnnual, SeasonalityWeight, OutputRevenueMonthly) are ON DELETE
// RESTRICT — the DB physically blocks a referenced delete. But CostLine (VENDOR)
// is ON DELETE SET NULL — the DB does NOT block it; it would silently null
// vendorId on those cost lines. So this server-side isReferenced re-check is the
// ONLY guard for vendor references. Re-check at action time — never trust the
// client's (possibly stale) button state.
export async function deleteEntity(id: string): Promise<ActionResult> {
  const refs = await getEntityReferences(id);
  if (isReferenced(refs)) {
    return {
      ok: false,
      error:
        "Cannot delete: this entity is referenced by plan data. Archive it instead.",
    };
  }
  try {
    await prisma.entity.delete({ where: { id } });
  } catch {
    // Backstop: a reference could appear between the check and the delete, or a
    // RESTRICT client FK could still block. Refuse rather than surface a 500.
    return {
      ok: false,
      error:
        "Cannot delete: this entity is referenced by plan data. Archive it instead.",
    };
  }
  revalidatePath("/entities");
  return { ok: true, id };
}
