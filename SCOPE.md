v0.9 | 2026-07-12

# Master Budget — SCOPE

Status: working draft. Items marked `[TBD]` / `[PENDING]`. Revised continuously; the MVP feeds this doc, not the reverse.

## 0 — Project declaration
Read this first (per CLAUDE.md Part A — it tells you where this project sits).
- **Type:** coding project → **CLAUDE.md Part B applies.**
- **Required governance docs:** SCOPE.md, WORKFLOW.md, ARCHITECTURE.md, DATASET.md, BACKLOG.md.
  - STYLE.md — created when a project-wide UI/UX decision is finalized (deferred).
  - process.md — none yet; add if project-specific processes emerge.
- **Branch/PR discipline:** **feature-branch + PR. No direct commits to main.** One feature branch per task, named `type/short-description` (type ∈ feat, fix, docs, refactor, chore, style, test, perf, build, ci, uat), branched from up-to-date main → commit → push → PR when asked → merge → post-merge cleanup (per CLAUDE.md Part A/B). The project is treated as deploy-bearing.
- **Deploy status:** not yet hosted; branch discipline is adopted now regardless, ahead of hosting.
- **Editing existing governance docs:** targeted edits to existing repo docs (SCOPE, WORKFLOW, ARCHITECTURE, DATASET, BACKLOG) are made by Claude Code directly in the repo, working from the current file on the branch — not regenerated from an external copy and pasted over (which risks reintroducing stale content). Discussion and exact wording are settled first; Code applies the scoped edit, shows the diff for approval, then commits. Drafting brand-new docs from scratch may still happen outside the repo, but once a doc exists, edits go through Code in-repo.

## 0a — Repository structure (placement principle)
Where things live in the repo. This is a **placement principle**, not a fixed folder map — so new WFs/clients slot in without reorganizing existing files.

- **Code is always at root (trunk).** The engine, the app, the generic logic — all universal, all root. There is **no per-subgroup or per-customer code** (that would be the `if customer == SP` forking §13 forbids). Customization is expressed as data/config, never as branched code.
- **Data/config is placed by ownership level:**
  - **Master-level** (standard, reusable) → **root** (standard WF templates, default catalogs, config-as-data defaults).
  - **Subgroup-level** → that subgroup's folder (subgroup-specific templates/settings, *if/when* they diverge from master).
  - **Customer-level** → that customer's folder (e.g. `client-sp/`): the customer's own unique content only — its actual input data, logo, a customized WF derived from a template, customer-specific overrides. **No code.**
- **Folders hold content, never logic.** A function always goes to root; only *data* has a folder question, answered by "whose data is it?"
- **Current MVP instance:** root = trunk app + all standard content; `client-sp/` = SP's minimal unique data (e.g. its DESIGN.md); a subgroup folder is deferred until subgroup-specific content exists. Reorganizable under this principle as new WFs/clients arrive.

## 1 — Purpose
A business budgeting tool: planning (P&L + cashflow projection) and execution (actual AR/AP reconciled against an approved plan). One generic engine, applied across industries and customers via a layered customization model — general logic is global; specifics cascade down.

## 2 — Revenue, Cost, Passthrough, Profit/Earnings
- **GP** = Gross Profit = Revenue − Cost of Goods Sold (COGS)
- **EBIT** = Operating Profit = Gross Profit − Operating Expenses (OPEX)
- **EBITDA** = Earnings Before Interest, Tax, Depreciation, and Amortization
- **Passthrough** = pay on behalf of a customer — no profit, not taxable
- **Cost categories:** COGS, OPEX, CAPEX, Tax. Tax is its own category (not inside OPEX): excluded from EBITDA, included in cashflow. Amortization & Depreciation are **types under CAPEX** (entered as one-time cash events; see §2a).

### 2a — EBITDA vs. Cashflow membership (principle)
P&L and Cashflow answer two different questions and include different lines.
- **EBITDA (P&L bottom line)** = operating performance = Revenue − COGS − OPEX. **Excludes** CAPEX, Tax, and non-operating items.
- **Cashflow** = "how much cash is on hand, and when." **Pure cash in/out — no accounting spread, no accrual smoothing, not GAAP.** Every cash-moving item hits cashflow at the moment cash actually moves (anchor + term). Nothing is spread, deferred, or amortized for cash purposes.
- **Two membership sets:** *In EBITDA* → Revenue, COGS, OPEX. *In Cashflow* → everything with a cash movement (the above **plus** CAPEX, Tax, and any other pure-cash item).
- **Design rule:** EBITDA-eligibility vs. cashflow-eligibility is **data-driven membership** (config-as-data), not hardcoded. CAPEX and Tax are the current "cashflow-yes, EBITDA-no" members; more such items can be added without special-casing.

## 3 — Plan / Actual / LE
- **Plan status = Published | Draft.**
  - A **discarded** Draft (closed without saving) is not saved — simply gone.
  - A saved plan (Published or Draft) can be **deleted** — also simply gone.
  - Discard and delete carry no status.
- **Plan of record** — the user designates which **Published** plan is the plan of record (a user designation, not a system-enforced lock).
- **Actuals** — incoming AR/AP transactions.
- **LE (Latest Estimate)** — rolling output of plan + recon = actuals-to-date + adjusted forward plan over the full horizon. A distinct object, not "the edited plan."
- **Reconciliation** compares Actuals vs the baseline Plan (same bucket, prorated); LE is the updated rolling view. Reconciliation can run against a **top-down or bottom-up** plan.
- All are version-controlled.

## 4 — Application Structure
`Master → Industry → Group → Subgroup → Customer`

The five levels exist, but only three are **cascade-bearing** (carry config, templates, logic, or mapping authority); the other two are organizational tags only.
- **Master** *(cascade-bearing)* — global standards, logic, engine, global/ISO mappings.
- **Industry** *(tag only)* — grouping/organizing.
- **Group** *(tag only)* — grouping/organizing.
- **Subgroup** *(cascade-bearing)* — the customer's parent; a market niche within an industry. Carries templates.
- **Customer** *(cascade-bearing)* — adopts one or more templates and enters its own data.

Config and mapping resolution effectively span Master → Subgroup → Customer.

## 5 — Workflow model
- A subgroup has multiple pre-built **workflow templates**, available for customers to use.
- Customized workflows can be built at a customer's request.
- **Workflow step** = a node that has inputs and outputs (e.g. Revenue, Warehouse, Delivery, Labor, Office).
- **Composability (config-as-data):** workflow steps are built from a catalog of standard components — input components, output components, logic engines — each with an ID.
- A **workflow** is the wiring; steps/forks reuse catalog components. The catalog lives in per-type docs (WORKFLOW.md now; step/logic/etc. later) and converges to config data. **Templates = tagged, reusable workflows** a user can select.

**Links between steps:**
- **Sequential (pass-through):** upstream output feeds downstream input; may carry a UoM conversion, but no split. (e.g. Warehouse → Delivery)
- **Fork** (a step branches into child branches), typed:
  - **allocate** — an upstream quantity is split by % across branches; allocation lives at the fork.
  - **prioritize** — an upstream quantity first fulfills one downstream, the remainder goes to the other.

(When 100% of the upstream quantity is distributed to downstream — by allocate or prioritize — the children sum back to the upstream by definition. This is an inherent property of a fork, not a separate operation.)

Note: there is no per-step P&L. The **plan as a whole** produces the P&L; steps feed revenues/costs into that single plan-level P&L.

## 6 — Topdown, Bottomup, Reconciliation
**Topdown plan** = a fast, aggregated ballpark to assess business + cashflow impact. Minimize data entry — derive costs from ratios (e.g. GP%) rather than collect them. Precision (granular mapping/conversion for reconciliation/troubleshooting) is explicitly not the top-down goal.

**Bottomup plan** = build connections between workflow steps for accurate scenario planning and profitability root-cause analysis. Each step is calculated as unit-$ × units, with inter-step relationships. Much more data mapping, conversion, and entries.

**Reconciliation with actual** = can be compared with **both** top-down and bottom-up plans.

## 7 — Demand-dependency and Cost behavior (orthogonal)
Demand-dependency and cost behavior are **independent** attributes and must not be equated.
- **Demand-dependency:** a step's demand is **dependent** if it receives demand from an upstream supply request (offset by buffer); **independent** if its volume is not affected by other steps.
- **Cost behavior:** fixed / semi-fixed / variable — an accounting property of the cost itself.

**Example.** An entity sells **X** units, requiring **A** fixed headcount (salary — fixed), **B** office rental (fixed), **Y** people to make (variable), **Z** raw materials (variable). There is dependency X↔Y and X↔Z, but A and B are fixed regardless of X. Dependency and cost behavior align here, but that alignment is not a rule.

## 8 — Constrained Plan, Unconstrained Plan
- The maximum capacity of a supply-side step is constrained by its bottleneck operations.
- When demand meets the capacity constraint, throughput is capped for downstream; excess demand is cumulated as inventory (buffer) or lost.

## 9 — Planning Direction
- **Demand-driven plan:** demand propagates downstream → allocate/prioritize at each fork.
- **Supply-driven plan:** supply is fixed → allocate/prioritize demand channels.

## 10 — Time
- **Horizon:** multi-year, default CY+3 (a user-set default, not a hardcoded constant).
- **CY = the current (partial) year**, spanning **start month → December**. CY+1…CY+3 are full years. (Naming: use **CY**, not YR0.)
- **Bucket:** monthly (typical).
- **Window** (rolling, relative to now): historical (actuals) | now → now+x frozen (supply fixed) | now+x → now+y flexible (supply constrained) | now+y → ∞ free (supply unconstrained). Windows shift left as now advances. Window is a per-workflow-step property.
- **Proration:** "partial" always equals the prorated share of its equivalent full bucket. Seasonality is never renormalized; partial years are handled by grossing up the entered total (see WF-001 for the worked mechanism).

## 11 — Master data & mapping
- **Two effective scopes: Global/ISO → Customer.**
  - **Global/ISO** — currency ↔ country, UTC, port code, region codes, etc.
  - **Customer** — e.g. product ↔ family.
- **Global authority, variable audience:** some Global/ISO entries are effectively industry-specific only because other industries don't care — not because they're less than globally acceptable (e.g. port codes are global but only logistics consumes them). Scope stays global.
- **Currency:** lives in Master (Global/ISO) as a global catalog. **Account-level** Currency/Language/Timezone are the plan's global settings; **Ph1/V1 = default (USD / en / …)**; future = user selection + conversion. Entity-level currency is a future per-entity layer (default USD).
- **Approach:** define the thin skeleton first (primitive types + resolution/provenance mechanism), then extract content from SP, tagging scope as discovered. Do not author a global catalog speculatively.
- **Primitive types** `[draft]`: workflow, workflow step, fork(allocate|prioritize), link(sequential), component (input / output / logic-engine), mapping, assumption, window, template. `[Refine.]`

## 12 — Reconciliation
- `[TBD]`

## 13 — Customization model
Everything customizable — settings, mappings, assumptions, input schema, workflow, engine logic, output — is one kind of object: a layered attribute carrying (a) scope/level, (b) provenance (ISO / gov / association / customer), (c) an override-vs-drift flag.
- **Resolution:** one engine over a layered store. **DECIDED: config-as-data** (differences expressed as data/formulas interpreted by one generic engine, not per-client code) — provisional, "until proven wrong." `[TBD: narrow, sandboxed code escape hatch for genuine one-offs — tagged as drift; hitting it is the "proven wrong" trigger.]`
- **MVP guardrail:** build only the thin engine SP's ph1 workflow needs, but never write `if customer == SP` branches — every SP-specific thing is data/formula from day one.
- **Drift → promotion:** one-offs are tagged and promotable upward (customer nuance → subgroup/industry standard) as a metadata move, not a rewrite.

## 14 — Phases
- **MVP**
  - **Phase 1** — 1 customer. Topdown plan. Demand-driven. No reconciliation. (Concrete spec: WORKFLOW.md WF-001.)
  - **Phase 2** — 1 customer. Bottomup plan. Demand-driven. No reconciliation.
  - **Phase 3** — 1 customer. Add reconciliation and generate LE.
- **Multi-Subgroup** — new subgroup templates.
- **V1** — add login/auth.

## 15 — Decisions / open items
- `[DECIDED — provisional]` Config-as-data (§13). Open sub-item: escape-hatch design.
- `[DECIDED]` Cashflow = direct method, pure-cash timing, not GAAP (§2a); full 3-statement deferred.
- `[DECIDED]` Cost categories = COGS / OPEX / CAPEX / Tax; A&D are CAPEX types; Tax is its own category (§2).
- `[DECIDED]` P&L bottom line = EBITDA = Revenue − COGS − OPEX (§2, §2a).
- `[DECIDED]` Tax = user-entered, excluded from EBITDA, included in cashflow (§2a).
- `[DECIDED]` EBITDA-eligibility vs cashflow-eligibility = data-driven membership (§2a).
- `[DECIDED]` Allocation happens at allocate-forks (§5); ph1's is the asset/brokerage split.
- `[DECIDED]` Window is a per-workflow-step property (§10).
- `[DECIDED]` "segment" retired → workflow step / fork / consolidation.
- `[DECIDED]` Fork types = allocate | prioritize; direction-independent; "sum" is not a type (§5).
- `[DECIDED]` Demand-dependency and cost behavior are orthogonal (§7).
- `[DECIDED]` No per-step P&L; the plan produces the P&L (§5).
- `[DECIDED]` Only Master / Subgroup / Customer are cascade-bearing; Industry / Group are tags (§4).
- `[DECIDED]` Master data = Global/ISO → Customer; currency at Account (default USD), future selection+conversion (§11).
- `[DECIDED]` Plan status = Published | Draft; user designates plan of record; discard/delete carry no status (§3).
- `[DECIDED]` Reconciliation may run against top-down or bottom-up (§3, §6).
- `[DECIDED]` CY naming (not YR0); CY = partial current year, start month → Dec (§10).
- `[DECIDED]` Top-down: entity payment terms captured but unused; single revenue anchor applied to all (spelled out to user) — see WF-001.
- `[DECIDED]` GP% cost = allocated-revenue-of-month × (1 − GP%) — see WF-001.
- `[TBD]` Top-down output targets + plan-side reconciliation.
- `[PARTIAL]` Versioning defined (§3); `[TBD]` finalize/lock + scenario machinery, approval mechanism.
- `[TBD]` Bottom-up demand: unit(s), entry point, demand→driver mapping (Phase 2).
- `[TBD]` Cost-behavior detail (fixed / semi-fixed / variable + drivers); "Office Variable" driver.
- `[TBD]` Supply-driven / constrained-window mechanics.
- `[TBD]` Governance files not yet created: STYLE.md (deferred until concrete).

## 16 — Changelog
- **v0.9 (2026-07-12):** Added §0 rule that edits to existing governance docs are made by Code in-repo (prevents stale-copy drift).
- **v0.8 (2026-07-12):** Added §0a Repository structure (placement principle: code always root; data/config placed by ownership level; folders hold content not logic; client-sp = SP's unique data only). Moved BACKLOG.md to the required-docs list (now created). Removed the v0.7 transition note (that transition is complete).
- **v0.7 (2026-07-12):** Added §0 Project declaration (type = coding → Part B applies; required governance docs; branch/PR discipline = feature-branch + PR, no direct-to-main; deploy status). This is the last direct-to-main commit; work after it uses feature branches + PRs. Synced universal CLAUDE.md copy committed to the repo in the same commit.
- **v0.6 (2026-07-12):** Folded in WF-001 BRD decisions. Added §2a EBITDA-vs-cashflow membership principle. Cost categories COGS/OPEX/CAPEX (A&D = CAPEX types). P&L bottom line = EBITDA. Tax excluded from EBITDA, in cashflow. §10: CY naming (replaces YR0), CY = partial current year. §11: Account-level currency/lang/tz, default USD. Top-down anchor simplification and GP% cost mechanic recorded (detail in WF-001).
- **v0.5 (2026-07-10):** Rebuilt from v0.45 base — fork = allocate|prioritize (no "sum"); no per-step P&L; demand-dependency ⟂ cost behavior; hierarchy weighting; master data Global/ISO→Customer; Published/Draft + plan-of-record; recon against top-down or bottom-up.
