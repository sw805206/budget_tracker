v0.4 | 2026-07-12

# WORKFLOW.md — WF-001 (MVP Phase 1)

Status: working draft. Faithful formalization of the WF-001 BRD — structure, filled `[explain]` gaps, and unambiguous logic. Not a redesign. Governed by SCOPE.md v0.6.

## 0 — Identity
- **Workflow ID:** WF-001
- **Phase:** MVP Phase 1 (current)
- **Hierarchy:** Industry → Group → Subgroup → Customer = Logistics → Warehousing → Fulfillment Center → SP
- **Planning mechanism:** Topdown
- **Reconciliation mechanism:** n/a (Phase 1)
- **Nature of top-down:** broad-stroke, aggregated ballpark. Simple logic by design. (Bottom-up per-step input/output/conversion/logic engines are future work.)

## 1 — Navigation
Landing · Plans · Actuals · Master Data · Account.

## 2 — Landing
The user sees: current plan, actual, LE; and a general Planning + Reconciliation process flow diagram.

## 3 — Plans

### 3.1 Landing / Dashboard
- **Available workflow cards** → button **Create New** (select one to create a new plan).
- **Past plans** → button **Copy Existing** (copy from an existing Published plan).
- Plan stages: **Published** (official) | **Draft** (in progress). (Discard/delete per SCOPE §3.)

### 3.2 The 4 steps
`Planning Version → Planning Parameters → Planning Assumptions → Results`

### 3.3 Planning Version
For both Create New and Copy Existing:
- User enters a **file name** (default `WF-###-yyyymmdd`).
- User selects a **start month** (default = current month).

### 3.4 Planning Parameters (section 2)
- **Create New** → Q&A session → summary page → **NEXT** confirms.
- **Copy Existing** → summary page → edit → **NEXT** confirms.

WF-001 parameters:
1. **[enter]** Planning horizon — number of **full** years (x) after CY; default 3, range 0–10. Year columns = CY + x (i.e. x + 1 total). CY = start month → December (partial if start ≠ Jan). **Validation:** if start month ≠ Jan **and** x = 0 → error ("you don't have a full year").
2. **[multi-select]** Warehouse Operations: (1) Asset-based, (2) Brokerage. `[explain shown to user]`
3. **[multi-select]** Delivery Options: (1) Client Pickup, (2) B2B/Trucking, (3) B2C/Courier. `[explain shown to user]`
4. **[enter]** Beginning Cash $.
5. **[enter]** Target on-hand Cash ($ or # months of costs).
- **If parameter 2 or 3 has >1 selection**, ask **revenue allocation %** to each flow. (In top-down, the fork operation **prioritize is not applicable**; allocation only.)

### 3.5 Planning Assumptions
Two tabs — **Revenue** and **Cost**.
- **Create New** → blank pages (Cost tab: prepopulated with "commonly used" descriptions).
- **Copy Existing** → carry over the existing plan's numbers.
- Uses the current plan's planning parameters.
- **If an operational step is a single selection, the irrelevant bucket is not shown.**

#### 3.5.1 Revenue assumption page
How it works: the user builds annual revenue per client per year, plus a per-client 12-month seasonality curve; the engine breaks annual $ into months via seasonality, with CY treated as a partial year (start month → December).

User inputs:
1. **Client** (select from Entity).
2. **CY … CY+x annual revenue.** `CY* = enter revenue for the start month → December only; do not include past months' forecast.`
3. **Revenue seasonality** — 12 monthly % (sum 100%). `Seasonality** = the default for a new client is the revenue-weighted average of existing clients' curves, weighted by each client's 1st-full-year revenue (CY if Jan-start, else CY+1); can be manually overwritten.`
- **Total row** (derived, not stored) = sum of clients (revenue); revenue-weighted average of clients' curves, weighted by each client's 1st-full-year revenue (seasonality).

**CY partial-year mechanism (worked example, Start 2026-03):**
- Entered CY* is the actual Mar–Dec total. Full-year (CY+1…) entries are Jan–Dec totals.
- The 12-month seasonality curve is **never renormalized.** Active CY months = Mar–Dec.
- Implied full-year CY = CY* ÷ (sum of active-month weights). Monthly figure = implied full-year × that month's weight.
- Example: Client 1 CY* = $5,000, active Mar–Dec weights sum to (1 − Jan − Feb). Implied full-year = **$6,024**; each month = $6,024 × its weight; Mar–Dec sum back to $5,000. (Client 2: $8,700 → $11,154.)

#### 3.5.2 Cost assumption page
How it works: the user lists cost lines (prepopulated with common descriptions), each tagged by operational step, category, type, timing, and UOM; the engine expands each line across months per its timing and computes $ (or GP%-derived) cost.

User inputs:
1. Add/edit/delete **description**.
2. Select **category** and **type**. (Category ∈ COGS / OPEX / CAPEX / Tax; type per the catalog, e.g. Amortization/Depreciation under CAPEX.)
3. **Vendor** (select from Entity).
4. **Timing** — one time | annual | quarterly | monthly. For monthly, default start/finish = start month … December of CY+x.
5. **UOM** — predefined to **$** or **GP%**.
6. Enter the **yyyy-mm** and the **values**.
- **If an operational step is a single selection, the irrelevant bucket is not shown.**

**Category / type catalog (WF-001, prepopulated "commonly used"):**
- **Asset-Based:** Deposit (CAPEX/Amortization, One-Time, $); Asset-Purchase (CAPEX/Depreciation, One-Time, $); Rental, Utilities, Insurance, Packaging/MRO, Office Expenses, Ops Lead, Direct Labor, Others (COGS, Monthly, $).
- **Brokerage:** Operating Cost (COGS, Monthly, GP%); Operating Cost (COGS, Monthly, $); Others (COGS, Monthly, $).
- **Delivery:** Self-Pickup, B2B Trucking, B2C/Courier (COGS, Monthly, GP%); Others (COGS, Monthly, $).
- **Office Expenses (OPEX):** Entity & Licences (Annual, $); Office Rental, Outsourced Services, Office Supplies, Travel & Entertainment, Others (Monthly, $).
- **Tax (category = Tax, not OPEX):** Tax (Quarterly, $). Excluded from EBITDA; included in cashflow.
- **Overhead (OPEX):** Sales Reps, Customer Service, Tech Team, Backoffice, Others (Monthly, $).
- **Commission (OPEX):** Sales Commission (Monthly, GP%).
- **Others (OPEX):** Others (Monthly, $).

### 3.6 Results
After both tabs are entered, the user clicks **NEXT** to generate the P&L report.

## 4 — Computing Logic

### 4.1 Revenue
- Broken down to monthly using annual $ × seasonality (CY partial per §3.5.1).
- Aggregated to annual / quarterly / monthly per user selection.

### 4.2 Fork operations
- **Prioritize is not applicable** for top-down.
- Use the **revenue allocation %** to assign revenue to asset-based vs. brokerage, and to pickup / B2B / B2C.

### 4.3 Cost
- **Annual** timing: apply the $ or GP% at the entered yyyy-mm, then repeat every 12 months.
- **Quarterly** timing: apply at the entered yyyy-mm, then repeat every 3 months.
- **Monthly** timing: apply from the start yyyy-mm through the end yyyy-mm.
- **GP% value:** cost = **allocated revenue of the month × (1 − GP%)**. (GP% applies to that flow's allocated revenue.)
- **CAPEX (incl. A&D) is excluded from the P&L** (EBITDA). See §4.5.

### 4.4 P&L (EBITDA)
- **EBITDA bottom line = Revenue − COGS − OPEX.** (OPEX subtotal is clean — Tax is its own category, not in OPEX.)
- **Excludes** CAPEX and Tax (both are their own categories; user-entered but not in EBITDA).
- No payment-term offset in the P&L (P&L is recognition-timed, not cash-timed).

### 4.5 Cashflow (pure cash, not GAAP)
- **Includes CAPEX and Tax** — every cash-moving item, at the moment cash moves. No accounting spread/accrual.
- Revenue and costs are offset by **payment anchor + months**.
- **Top-down simplification:** the anchor is simplified to **Revenue's anchor**; all items are treated with the same anchor as revenue. **Entity payment terms are captured in Master Data but NOT used in top-down cashflow** — they wait for bottom-up / reconciliation. This must be **spelled out to the user**.
- Per time bucket: **Beginning Cash + Net Cash = Ending Cash.**

## 5 — Report Display
- User selects **annual / quarterly / monthly** display.
- **CY is a partial-year number.**
- Numbers **and** graphs.
- **Single time bucket** and **cumulative** views.
- P&L sample (illustrative): Profit(=EBITDA) / Cumulative rows; Revenue / Costs / COGS / OPEX rows across CY…CY+3.
- Cashflow sample: `[layout TBD — mirror P&L display with Beginning/Net/Ending cash]`.

## 6 — Master Data — Entity
The user adds/edits/deletes entity information. The Entity table serves both planning and **future reconciliation**.
- **Entity ID** — autogenerated.
- **Entity name*** — manual, changeable anytime, duplicate-checked.
- **Type*** — client, vendor, government, employee, contractor, others.
- **Payment Flow*** — AR (revenue/income) | AP (cost/spending) | Passthrough.
- **Payment Term*** — select payment anchor + # of days (default = Statement + 30). Anchor options: Sales Order, Statement, Net, Arrival, Departure.
- **mappedID** — placeholder (future).
- **Currency*** — placeholder (future), default USD.
- **Entity Information** — placeholder (future).
- **Tags** — manual.
- **Internal POC** — placeholder (future).
- **Comments.**

Behaviors:
- View entity card; view entity list (table); download file; download template and upload via template.
- The user can **add an entity from the assumption page** — it autogenerates an Entity record with critical fields to complete.
- **Compute gate:** an incomplete Entity (any mandatory/asterisked field missing — name, Type, Payment Flow, Payment Term, Currency) **blocks compute entirely** — the plan produces no output until all referenced Entities are complete. In editing mode, recompute surfaces a "complete these entities first" state instead of results. (Currency is mandatory but auto-satisfied by the USD default in Ph1, so it never blocks now.) This is stronger than a Publish-only gate.
- Entity master-data changes impact **Draft and future plans, not Published plans.**

## 7 — Account (global settings)
- Language · Time zone · Currency.
- **Ph1/V1 = default** (USD / en / …). Future = user selection + conversion.

## 8 — Open items
- `[TBD]` Cashflow sample display layout (§5).
- `[DECIDED]` Tax is its own category (not inside OPEX); excluded from EBITDA, included in cashflow (§3.5.2, §4.4).
- `[TBD]` `[explain]` copy for Warehouse Operations and Delivery Options parameters (§3.4).
- `[TBD]` Revenue/Cost assumption page `[explain how it works]` user-facing copy.

## 9 — Changelog
- **v0.4 (2026-07-12):** Consistency update with DATASET.md v0.1. Horizon rule corrected to CY+x full years (default 3, range 0–10) with the x=0/non-Jan validation error. Seasonality default and Total-row weighting made explicit (revenue-weighted by each client's 1st-full-year revenue). Entity gate changed from Publish-gate to **compute-gate** (incomplete Entity blocks compute entirely).
- **v0.3 (2026-07-12):** Tax moved to its own category (out of OPEX); category set now COGS / OPEX / CAPEX / Tax. OPEX subtotal clean. Dropped hh:mm from version line.
- **v0.2 (2026-07-10):** Formalized from the WF-001 BRD. Filled logic gaps; made category/type catalog explicit; stated CY partial-year mechanism with worked example; stated EBITDA vs cashflow membership (CAPEX/Tax cashflow-only); recorded top-down single-anchor simplification and GP% cost mechanic; captured Entity master-data rules.
