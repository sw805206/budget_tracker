# Client SP — DESIGN

**v0.1 — last updated 2026-07-08**
SP's assembly + data. SP adopts generic workflows (see `../WORKFLOW.md`); this doc holds SP-specific choices, data, and nuances. Default scope tag `[client]` unless marked for promotion. Model in `../SCOPE.md`.

## Identity
- **SP** — e-commerce fulfillment specialist.
- Hierarchy: `Logistics ▸ Warehousing ▸ Fulfillment Center`.
- Full operation (future): inbound receive → warehouse → outbound shipping (b2b / b2c) + value-added. **Ph1 covers warehouse only.**

## Phase 1 — adopted workflow
- Adopts **`WF-001`** (Fulfillment Center, top-down).
- **Ph1 bound:** warehouse **asset + brokerage** as **one allocate fork**; demand-driven; free window; **P&L + cashflow**; **no reconciliation**; aggregated ballpark (top-down principle).

## SP data (to fill)
- **Settings:** currency USD · timezone = machine · language EN — `[global defaults; no override in ph1]`.
- **Time horizon:** CY+3 · start = current month — `[editable]`.
- **Business decision — target cash on hand:** a number, or # months of fixed/semi-fixed cost — `[role TBD: reference/alert line on cash]`.
- **Revenue:** Warehouse operations, Delivery services — annual + seasonality — `[data TBD]`.
- **GP%** per variable line — `[data TBD]`.
- **Asset/brokerage allocation %** (the ph1 allocate fork) — `[data TBD]`.
- **Fixed costs:** warehouse fixed · labor (Sales & CSR, Backoffice) · entity & licenses/permits · office fixed · outsourced services · T&E — `[data TBD]`.
- **Capex:** upfront asset spend (cashflow only) — `[data TBD]`.
- **Timing terms:** AR/AP per revenue/cost line — `[data TBD; math later]`.

## Open placeholders
- Cost-behavior detail: fixed / semi-fixed / variable + drivers — `[TBD]`.
- "Office Variable" driver — `[TBD]`.
- Delivery B2B/B2C split — `[deferred to bottom-up]`.
- Operational tree beyond warehouse (inbound, outbound, value-added) — `[deferred]`.

## Notes
- Real financials (actual rates, numbers) stay **out of git** per `.gitignore` — this doc holds structure, not confidential values.
