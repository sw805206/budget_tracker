// ─────────────────────────────────────────────────────────────────────────────
// Entity reference seam (BL-011) — the SINGLE source of truth for "what references
// this Entity." Every table holding a foreign key to Entity is enumerated HERE and
// nowhere else. Phase 3 (reconciliation) adds its table in ONE place: append it to
// the CLIENT_REF / VENDOR_REF union list below (and flip `reconciliations` off null).
//
// The four FK tables today (verified against the migration SQL, Checkpoint 0):
//   RevenueAnnual        (client, clientId)        ON DELETE RESTRICT
//   SeasonalityWeight    (client, clientId)        ON DELETE RESTRICT
//   OutputRevenueMonthly (client, clientId)        ON DELETE RESTRICT
//   CostLine             (vendor, vendorId)        ON DELETE SET NULL
//
// ── DELETE-SAFETY ASYMMETRY (read before touching the delete action) ──────────
// The three CLIENT tables are ON DELETE RESTRICT: the database itself physically
// blocks deleting a referenced Entity — app gate and DB agree.
// CostLine (VENDOR) is ON DELETE SET NULL: the database does NOT block the delete;
// it would silently null `vendorId` on those cost lines. So for VENDOR references
// the APP-LAYER gate is the ONLY protection. Any server-side delete MUST refuse
// whenever isReferenced is true — because for vendors the DB will not.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type EntityReferences = {
  publishedPlans: number;
  draftPlans: number;
  reconciliations: null; // Phase 3 not built — null means "not yet countable", NOT zero.
};

// Derived: referenced if ANY of the four FK tables points at this entity. (Reconciliation
// null never counts toward referenced.) True whenever a delete would be DB-blocked (the
// three RESTRICT client tables) OR would silently orphan data (CostLine SET NULL).
export function isReferenced(refs: EntityReferences): boolean {
  return refs.publishedPlans + refs.draftPlans > 0;
}

// Full usage breakdown for ONE entity (the detail card). Counts DISTINCT plans that
// reference the entity through any of the four FK tables, grouped by the referencing
// PlanVersion's status. Each table reaches status via planVersionId -> PlanVersion.status
// and the plan via PlanVersion.planId. Distinct PLANS, not reference rows: a client with
// revenue + seasonality + output rows in one plan counts as one plan, not three.
export async function getEntityReferences(
  entityId: string,
): Promise<EntityReferences> {
  // Raw SQL (parameterized via Prisma.sql — ${entityId} is a bound value, not
  // interpolated). Uses only standard SQL (UNION ALL / COUNT(DISTINCT) / GROUP BY,
  // no SQLite-specific syntax), but raw queries bypass Prisma's dialect handling —
  // RE-VERIFY this and getReferencedEntityIds at the future Postgres migration.
  const rows = await prisma.$queryRaw<
    Array<{ status: string; planCount: number }>
  >(Prisma.sql`
    SELECT pv."status" AS status, COUNT(DISTINCT pv."planId") AS planCount
    FROM (
      SELECT "planVersionId" AS pvId, "clientId" AS entId FROM "RevenueAnnual"
      UNION ALL
      SELECT "planVersionId", "clientId" FROM "SeasonalityWeight"
      UNION ALL
      SELECT "planVersionId", "clientId" FROM "OutputRevenueMonthly"
      UNION ALL
      SELECT "planVersionId", "vendorId" FROM "CostLine" WHERE "vendorId" IS NOT NULL
    ) refs
    JOIN "PlanVersion" pv ON pv."id" = refs."pvId"
    WHERE refs."entId" = ${entityId}
    GROUP BY pv."status"
  `);

  let publishedPlans = 0;
  let draftPlans = 0;
  for (const r of rows) {
    const n = Number(r.planCount);
    if (r.status === "Published") publishedPlans = n;
    else if (r.status === "Draft") draftPlans = n;
  }
  return { publishedPlans, draftPlans, reconciliations: null };
}

// Batch isReferenced for the LIST view — one grouped query over the listed set, NOT
// N queries per row. Returns the subset of the given ids that are referenced by any of
// the four FK tables. (No PlanVersion join needed: every FK row already implies a plan.)
export async function getReferencedEntityIds(
  entityIds: string[],
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const ids = Prisma.join(entityIds); // bound parameters, one per id (not interpolated)
  // Raw SQL (standard UNION/IN, no SQLite-specific syntax) — re-verify at Postgres migration.
  const rows = await prisma.$queryRaw<Array<{ entId: string }>>(Prisma.sql`
    SELECT "clientId" AS entId FROM "RevenueAnnual"        WHERE "clientId" IN (${ids})
    UNION
    SELECT "clientId"          FROM "SeasonalityWeight"    WHERE "clientId" IN (${ids})
    UNION
    SELECT "clientId"          FROM "OutputRevenueMonthly" WHERE "clientId" IN (${ids})
    UNION
    SELECT "vendorId"          FROM "CostLine"             WHERE "vendorId" IN (${ids})
  `);
  return new Set(rows.map((r) => r.entId));
}
