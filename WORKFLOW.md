# Master Budget — WORKFLOW catalog

**v0.1 — last updated 2026-07-08**
Catalog of reusable **workflows** (graphs of workflow steps). Each entry is tagged; a user can adopt an existing workflow instead of building one. Design-phase scaffold — converges to config data. Model defined in SCOPE.md §3.

**Legend**
- `step` = a node (workflow step).
- `─▶` sequential link (pass-through; optional UoM convert; **no split**).
- `fork[allocate]` = split an upstream quantity **by %** across branches.
- `fork[sum]` = independent child lines that **add** to the parent.
- **Consolidation** = sum of all step P&Ls (topology-independent).
- Scope tags: `[global]` / `[industry]` / `[subgroup]` / `[client]`.

---

## WF-001 — Fulfillment Center, top-down (Phase 1)

- **Tags:** `industry:logistics` · `group:warehousing` · `subgroup:fulfillment-center` · `grain:top-down` · `mode:demand-driven` · `window:free` · `phase:1`
- **Scope level:** `[subgroup]` — generic to fulfillment centers; SP adopts it and enters data.
- **Purpose:** fast, aggregated P&L + cashflow ballpark (top-down principle, SCOPE §5). Minimize data entry; derive costs from ratios.

### Graph

Root: **Revenue** `[input: annual + seasonality, by stream]` — streams: *Warehouse operations*, *Delivery services*.

**COGS path (sequential):**
```
Revenue ──COGS──▶ Warehouse ──▶ Delivery
                  %GP            %GP
                  fork[allocate] fork[allocate]
                  ├ Asset        ├ B2B
                  └ Brokerage    └ B2C
```
- **Warehouse** — cost = f(revenue, GP%); `fork[allocate]` by asset/brokerage share:
  - **Asset** → Warehouse Fixed (not volume-driven) + **Upfront Asset Spend** (capex → **cashflow only, not P&L**)
  - **Brokerage** → Warehouse Variable (tie to revenue via GP%)
- **Delivery** — sequential after Warehouse; cost = variable via GP%; `fork[allocate]` B2B / B2C `[bottom-up detail deferred]`

**OPEX path (parallel sum):**
```
Revenue ──OPEX──▶ Labor + Office + Entity + T&E
```
- **Labor** `fork[sum]`: Sales & CSR (fixed) + Backoffice (fixed)
- **Office** `fork[sum]`: Office Fixed + Office Variable `[driver TBD]`
- **Entity** — Entity & Licenses/Permits (fixed)
- **T&E** — Travel & Entertainment (fixed)

### Engine (top-down)
seasonality → monthly revenue · GP% → variable cost · allocate fork → asset (fixed + capex) vs brokerage (variable) · sum fixed lines · timing terms → cashflow (direct method) · capex → cash only · consolidate all step P&Ls.

### Inputs
revenue by stream (annual + seasonality) · GP% per variable line · fixed-cost lines · capex · asset/brokerage allocation % · AR/AP timing terms.

### Outputs
aggregated **P&L** + **cashflow** (table + graph); target-cash reference line `[role TBD]`.

### Deferred (bottom-up, not in ph1)
revenue breakdown (Inbound Receive, Storage, Outbound Pick & Pack, Delivery, Value-added) · Delivery B2B/B2C cost split · granular mapping.
