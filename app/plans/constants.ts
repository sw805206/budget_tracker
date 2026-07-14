// ─────────────────────────────────────────────────────────────────────────────
// Plan wizard constants — CONFIG-SHAPED STAND-IN (same pattern as
// app/entities/constants.ts). Config-shaped data (no logic), standing in for the
// future config-as-data directory (ARCHITECTURE §3/§7, DATASET §8).
// To be migrated there in a dedicated later task — see BACKLOG.md (BL-007).
//
// WF-001 is the only workflow in Ph1; its fixed identity is chosen via the
// "workflow card" (WORKFLOW §3.1) and stamped onto the Plan at Step 1, since the
// wizard doesn't collect the Industry→Group→Subgroup→Customer hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

// WF-001 identity (WORKFLOW §0). Written to the Plan's NOT-NULL identity fields.
export const WF001_IDENTITY = {
  workflowRef: "WF-001",
  industry: "Logistics",
  group: "Warehousing",
  subgroup: "Fulfillment Center",
  customer: "SP",
} as const;

// Structural steps (DATASET §2). `step` values match PlanStepSelection.step /
// PlanVersionAllocation.step; `options` match .option / .flow.
// NOTE: canonical "Asset-Based" casing (schema/DATASET §2). WORKFLOW §3.4 writes
// "Asset-based" — that variance is logged for doc reconciliation.
export const STEP_WAREHOUSE = "Warehouse Operations";
export const STEP_DELIVERY = "Delivery Options";

export const PLAN_FORKS = [
  { step: STEP_WAREHOUSE, options: ["Asset-Based", "Brokerage"] },
  {
    step: STEP_DELIVERY,
    options: ["Client Pickup", "B2B/Trucking", "B2C/Courier"],
  },
] as const;

// Planning horizon (WORKFLOW §3.4 / DATASET §3.2): full years after CY.
export const HORIZON_DEFAULT = 3;
export const HORIZON_MIN = 0;
export const HORIZON_MAX = 10;

export type TargetCashMode = "dollars" | "months";
