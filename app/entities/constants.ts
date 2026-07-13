// ─────────────────────────────────────────────────────────────────────────────
// Entity constants — CONFIG-SHAPED STAND-IN.
//
// (a) Config-shaped constants (plain data, no logic, no branching) that stand in
//     for the future config-as-data directory (ARCHITECTURE §3 / §7, DATASET §8).
//     Two groups live here: the logic-bearing dropdown OPTION SETS, and the Ph1
//     DEFAULT VALUES used to prefill a new Entity.
// (b) Both groups are to be MIGRATED into that config-as-data directory in a
//     dedicated later task; this file is a deliberate interim location, not a home.
// (c) Tracking: see BACKLOG.md — config-as-data directory migration item.
//
// Keep this file free of logic — data only. Any behavior (validation, defaulting)
// belongs in the UI/feature layer.
// ─────────────────────────────────────────────────────────────────────────────

// ── Option sets (enum stand-ins) ────────────────────────────────────────────
// The three logic-bearing dropdowns. Values double as their own display labels.

// Entity Type (DATASET §4 / WORKFLOW §6)
export const ENTITY_TYPES = [
  "client",
  "vendor",
  "government",
  "employee",
  "contractor",
  "others",
] as const;

// Payment Flow (DATASET §4 / WORKFLOW §6)
export const PAYMENT_FLOWS = ["AR", "AP", "Passthrough"] as const;

// Payment-Term anchor (DATASET §4 / WORKFLOW §6)
export const PAYMENT_TERM_ANCHORS = [
  "Sales Order",
  "Statement",
  "Net",
  "Arrival",
  "Departure",
] as const;

// Derived string-literal types (type-level only — not logic).
export type EntityType = (typeof ENTITY_TYPES)[number];
export type PaymentFlow = (typeof PAYMENT_FLOWS)[number];
export type PaymentTermAnchor = (typeof PAYMENT_TERM_ANCHORS)[number];

// ── Ph1 default values (prefill) ─────────────────────────────────────────────
// Defaults applied when creating a new Entity. These moved out of the DB columns
// (payment-term column defaults were dropped; currency is written by the app), so
// they are single-sourced here. Distinct from the option sets above.

// Payment-Term default: Statement + 30 days.
export const PAYMENT_TERM_DEFAULT = {
  anchor: "Statement",
  days: 30,
} as const;

// Currency default: USD (fixed Ph1 default; never shown, never blocks — DATASET §4).
export const CURRENCY_DEFAULT = "USD" as const;
