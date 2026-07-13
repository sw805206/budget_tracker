v0.1 | 2026-07-12

# DATASET.md — Master Budget (Canonical Data Model)

Status: working draft. The canonical data model for MVP Phase 1 (WF-001, top-down). Governed by SCOPE.md (v0.6), WORKFLOW.md WF-001 (v0.4), ARCHITECTURE.md (v0.1). Written to serve all of WF-001 and leave seams (not built structure) for Phase 2 (bottom-up) and Phase 3 (reconciliation).

This document is the contract: the Prisma schema and the engine both derive from it. It defines the nouns (entities, fields, relationships), not the UI or the computation.

## 1 — Core principle
**Plan = the logic. PlanVersion = the inputs that feed the logic. Outputs = logic applied to inputs.**
- The **Plan** (= Workflow, 1:1) defines *how* things compute — fixed, never versioned.
- A **PlanVersion** supplies *what* goes in — variable inputs, immutable once published.
- **Outputs** are the result of running the Plan's logic over a PlanVersion's inputs, stored at finest grain.

Design rule (from SCOPE): anticipated variation is expressed as **rows/records, not fixed columns/structure**.

## 2 — Plan (= Workflow)
1 Workflow = 1 Plan = 1 set of computing logic. The fixed layer.

- **id**
- **workflow ref** — e.g. WF-001
- **identity / hierarchy** — Industry → Group → Subgroup → Customer (e.g. Logistics → Warehousing → Fulfillment Center → SP)
- **approach** — top-down | bottom-up (WF-001 = top-down)
- **structure (steps / flows):**
  - **Warehouse Operations** step — options: Asset-Based, Brokerage (plan-level; defines which steps exist)
  - **Delivery Options** step — options: Client Pickup, B2B/Trucking, B2C/Courier (plan-level)
- **computing logic** — conversions, propagation, fork operations. Fixed; never versioned. (Logic is code/config bound to the Workflow, not stored per version.)

Notes:
- Logic is **not** versioned. All PlanVersions of a Plan share identical logic.
- The *structural selections* (which warehouse ops, which delivery options) are **plan-level**. The *allocation %* across them is a **PlanVersion input** (see §3).

## 3 — PlanVersion
The variable layer. Immutable once Published.

### 3.1 Meta
- **id**
- **plan ref** → Plan
- **name** — default `WF-###-yyyymmdd`
- **status** — Published | Draft
- **plan-of-record flag** — user designates one Published version as plan-of-record
- **what-changed note** — user-entered per version
- **timestamp(s)** — created / published

### 3.2 Version parameters (inputs)
- **start month** — yyyy-mm; CY = start month → December
- **horizon x** — number of **full** years after CY; default 3, range 0–10
  - **validation:** start month ≠ Jan AND x = 0 → **error** ("you don't have a full year")
  - **year columns** = CY + x (i.e. x + 1 total for all valid plans)
- **bucket** — monthly (Ph1 typical)
- **beginning cash** — $
- **target on-hand cash** — $ or # months of costs
- **allocation %** — revenue allocation across selected warehouse-op and delivery flows (asked only when a step has >1 selection). Top-down: allocate only; **prioritize not applicable**.

### 3.3 Revenue inputs
Entry UI = one row per client (annual figures + 12-month seasonality). Storage below.

- **Annual revenue** — records keyed **(PlanVersion × Client × Year)**; count = x + 1 (variable). Never fixed columns.
  - CY value = actual **start-month → December** total (partial if start ≠ Jan; full if Jan)
- **Seasonality** — **12 weights per Client** (sum 100%), one curve reused across **all** that client's years
  - **Default for a new client** = the revenue-weighted average of existing clients' curves, weighted by each client's **1st-full-year** revenue (CY if Jan-start, else CY+1); user-overridable
- **CY partial-year mechanism (engine):** implied full-year = entered CY ÷ (sum of active-month weights, Mar–Dec for a Mar start); monthly = implied full-year × month weight; curve **never renormalized**
- **Total row** — derived, never stored: revenue = sum of clients; seasonality = the same 1st-full-year revenue-weighted average
- Clients are **user-extensible** (add/edit/delete). A client references an **Entity** (Type = client).

### 3.4 Cost inputs (cost lines)
One record per cost line; **rule stored, engine-expanded** (not pre-populated into months). Cost lines are **user-extensible** (add/edit/delete; Create New prepopulates "commonly used" descriptions).

Per cost line:
- **description**
- **category** — COGS | OPEX | CAPEX | Tax
- **type** — per catalog (e.g. Amortization / Depreciation under CAPEX)
- **operational step** — Asset-Based | Brokerage | Delivery | Office Expenses | Overhead | Commission | Others
- **vendor** → Entity (Type = vendor)
- **timing type** — one-time | annual | quarterly | monthly
- **date / range** — single yyyy-mm anchor for one-time/annual/quarterly; start yyyy-mm → end yyyy-mm for monthly
- **UOM** — $ (dollar) | GP% (percentage)
- **value** — number; interpreted per UOM ($ amount, or % for GP%)

Engine expansion (WF-001 §4.3):
- **annual** → apply at anchor, repeat every 12 months
- **quarterly** → apply at anchor, repeat every 3 months
- **monthly** → apply across start→end range
- **one-time** → apply once at anchor
- **GP% value** → cost = allocated-revenue-of-month × (1 − GP%)
- **CAPEX & Tax** → excluded from EBITDA, included in cashflow (SCOPE §2a)

### 3.5 Outputs (stored, frozen at compute)
Stored at **monthly line-level detail** (finest grain):
- **per-client monthly revenue**
- **per-cost-line monthly expansion**

All report views derive from this stored detail:
- **EBITDA P&L** (Revenue − COGS − OPEX) and **Cashflow** (Beginning + Net = Ending)
- **report grain** — user-selectable: rolled-up | intermediate | client-line/cost-line detail (aggregations/reads of stored detail)
- **bucket** — user-selectable: annual | quarterly | monthly (aggregations of monthly)
- **graphs** — render from the same stored detail; single-bucket and cumulative views
- **CY** displays as a partial-year number

Cashflow specifics (WF-001 §4.5):
- Pure cash timing, not GAAP; includes CAPEX and Tax
- **Top-down simplification:** anchor simplified to Revenue's anchor; all items treated with revenue's anchor. **Entity payment terms are captured but NOT used in top-down cashflow** (reserved for bottom-up / reconciliation) — spelled out to the user.

## 4 — Entity (Master Data)
Shared across plans; also used for future reconciliation. Not stored inside a plan — referenced by it.

- **Entity ID** — autogenerated
- **Entity name*** — manual, changeable anytime, duplicate-checked
- **Type*** — client | vendor | government | employee | contractor | others
- **Payment Flow*** — AR (revenue/income) | AP (cost/spending) | Passthrough
- **Payment Term*** — payment anchor + # of days (default: Statement + 30); anchors: Sales Order | Statement | Net | Arrival | Departure
- **mappedID** — placeholder (future)
- **Currency*** — Phase 1: USD only (fixed default, never blocks). Future: selectable dropdown + exchange-rate table (values entered in entity currency; reports output in user-setting currency)
- **Entity Information** — placeholder (future)
- **Tags** — manual
- **Internal POC** — placeholder (future)
- **Comments**

Behaviors: view card; view list (table); download file; download template + upload via template.

Rules:
- **Inline creation:** a client (revenue) or vendor (cost line) can be added inline from the assumption tabs; this autogenerates an Entity record with critical fields to complete.
- **Mandatory fields = asterisked set:** name, Type, Payment Flow, Payment Term, Currency.
- **Compute gate:** an incomplete Entity (any mandatory field missing) **blocks compute entirely** — no output until all referenced Entities are complete. (In editing mode, recompute surfaces a "complete these entities first" state instead of results.) Currency is mandatory but auto-satisfied by the USD default in Ph1, so it never blocks now.
- **Change impact:** Entity changes affect **Draft and future** plans, **not Published** plans.

## 5 — Lifecycle (informs immutability constraints)
- **Editing (Draft):** entering/changing inputs triggers **recompute in place** (see results, BACK, adjust). Drafts are persisted (saveable, mutable).
- **Publish:** the version becomes an **immutable PlanVersion** — inputs and outputs frozen.
- **Changing a Published plan:** not allowed. Create a new plan, or **Copy Existing + edit**, which becomes a new PlanVersion on publish. Old version untouched.
- **Recompute** = updated inputs + fixed logic → updated outputs (an editing-mode action, not a versioning event).

## 6 — Relationships (summary)
```
Plan (= Workflow, 1:1) ──< PlanVersion
PlanVersion ──< Revenue annual records   (Client × Year)
PlanVersion ──< Seasonality curve         (per Client, 12 weights)
PlanVersion ──< Cost line                 (rule-stored)
PlanVersion ──< Output detail             (per-client monthly revenue; per-cost-line monthly)
Revenue record ──> Entity (client)
Cost line ──> Entity (vendor)
Entity : shared master data (not owned by any plan)
```

## 7 — Deferred seams (Phase 2 / 3 / future — not built in Ph1)
- **Bottom-up inputs** — unit-based entries, per-step input/output/conversion/logic engines (Phase 2).
- **Reconciliation** — actuals, plan-ID tie-out, delta, LE (Phase 3). Entity table and stored line-level output detail are the hooks.
- **Exchange-rate table** — future multi-currency (entity-currency entry → user-currency reporting).
- **Per-entity payment terms in cashflow** — captured now, applied in bottom-up / recon, not top-down.

## 8 — Open items
- `[TBD]` Exact Prisma field types / constraints (finalize at scaffold).
- `[TBD]` Whether output detail is stored as normalized monthly rows or a compact serialized series (storage-shape decision at scaffold; both satisfy this contract).
- `[TBD]` WF-001 to be updated with: the x=0/non-Jan error, the 1st-full-year seasonality weighting basis, and the compute-gate (currently phrased as Publish-gate). (Batched WF-001 edit.)

## 9 — Changelog
- **v0.1 (2026-07-12):** Initial canonical data model. Plan/PlanVersion split (logic vs inputs); revenue block (variable-year records, per-client seasonality, 1st-full-year weighting, CY gross-up); cost lines (rule-stored, engine-expanded); Entity master data + inline creation + compute gate on asterisked fields; currency Ph1/future phasing; outputs stored at monthly line-level detail feeding all report grains; lifecycle/immutability; deferred seams.
