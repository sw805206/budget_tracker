# Master Budget — SCOPE

**v0.4 — last updated 2026-07-08**
Status: working draft. Items marked `[TBD]` / `[PENDING]`. Revised continuously; the MVP feeds this doc, not the reverse.

> **Vocabulary note (v0.4):** "segment" is **retired** (overloaded/confusing). The operational units are now **workflow steps**; a step that branches is a **fork**, typed *allocate* or *sum*. See §3.

---

## 1. Purpose
A business budgeting tool: **planning** (P&L + cashflow projection) and **execution** (actual AR/AP reconciled against an approved plan). One generic engine, applied across industries and customers via a layered customization model — general logic is global; specifics cascade down.

## 2. Hierarchy (customization layers)
`Master → Industry → Group → Subgroup → Customer`
- **Subgroup** = the customer's parent; a market niche within an industry.
- **Templates** attach at Subgroup level = reusable **workflows** (§3) a customer can adopt from the catalog rather than build from scratch. A subgroup may expose several.
- A **Customer** adopts one or more templates and enters its own data.
- Example: `Logistics ▸ Warehousing ▸ Fulfillment Center`; client SP.

## 3. Workflow model (replaces "segment")
A customer's plan is a **workflow** — a directed graph of **workflow steps**.

- **Workflow step** = a node (e.g. Revenue, Warehouse, Delivery, Labor, Office). Same thing as the "step" in Axis A (§5).
- **Links between steps:**
  - **Sequential** (pass-through): upstream output feeds downstream input; may carry a **UoM conversion**, but **no split**. (e.g. Warehouse → Delivery)
  - **Fork** (a step branches into child branches), typed:
    - **allocate** — an upstream *quantity* is **split by %** across branches; allocation lives **at the fork**. (e.g. Warehouse → Asset / Brokerage)
    - **sum** — independent child lines that **add up** to the parent; nothing upstream is split. (e.g. Labor → Sales / Backoffice)
- **Consolidation** = roll-up: every step's P&L **sums** to the customer P&L, independent of graph topology. *The graph governs how demand flows; consolidation governs how money rolls up.*
- **Composability (config-as-data):** workflows are built from a **catalog of standard components** — *input components*, *output components*, *logic engines* — each with an ID. A **workflow** is the wiring; steps/forks reuse catalog components. The catalog lives in per-type docs (WORKFLOW.md now; step/logic/etc. later) and converges to config data. **Templates = tagged, reusable workflows** a user can select.

## 4. Three flows (distinct — do not conflate)
- **Config cascade** (inheritance, downward, on the *hierarchy* tree §2) — resolves *attributes* (settings, mappings, assumptions, logic). Semantics = override.
- **Demand cascade** (allocation, downward, on the *workflow* graph §3) — demand flows through steps; at **allocate forks** it splits by %. Semantics = allocation.
- **Consolidation** (aggregation, upward) — step P&Ls roll up to the customer. Semantics = sum.

## 5. Three axes of a plan (orthogonal)
A cell = `workflow step × grain × time-bucket`.

- **Axis A — Demand / Supply (what binds).** An operations/constraint concept, *not* a synonym for top-down/bottom-up. Demand propagates downstream (unconstrained); supply constrains at each step (constrained); inventory/buffer decouples steps. Driving mode is per `(step × time)`, set by the window + engine. `[TBD: detailed bottleneck logic.]`
- **Axis B — Top-down / Bottom-up (input grain; a continuum, not fixed tiers).**
  - *Top-down*: coarse — dollars, annual buckets; demand = revenue$, supply = cost$; compute P&L/cash directly.
  - **Top-down principle:** the goal is a **fast, aggregated ballpark** to assess business + cashflow impact. **Minimize data entry** — *derive* costs from ratios (e.g. GP%) rather than collect them. Precision (granular mapping/conversion for reconciliation/troubleshooting) is **explicitly not** the top-down goal — that's bottom-up/recon.
  - *Bottom-up*: fine — units per step, with inter-step relationships. Much more data entry/mapping.
  - *Reconciliation*: finest — actual transactions.
  - Grain conversion (both directions) is governed by **assumptions + mapping**. No hard grain tiers.
- **Axis C — Time.** See §6.

## 6. Time model (Axis C)
- **Horizon:** multi-year, default **CY+3** (3–5 yrs).
- **Bucket:** monthly (typical).
- **Window** (rolling, relative to *now*):
  `… Historical (actuals) │ now→now+x Frozen (supply fixed) │ now+x→now+y Planning (constrained per step) │ now+y→∞ Free (unconstrained)`
  Windows shift left as *now* advances. Window is a **per-workflow-step** property. `[TBD: x, y.]`
- **Axis A × window scoping (important):** the forward-flow model — demand propagating downstream, **allocate forks splitting by %** (§3) — is the **demand-driven / free-window** regime. Under **constrained windows** (Frozen/Planning) supply binds and flow behaves differently (pull/constraint-based) — **deferred**. Ph1 is demand-driven only, so this regime *is* ph1's model.
- **Proration:** actual transactions on partial periods are prorated to the full bucket. `[default = prorate-to-full.]`

## 7. Plan / Actual / LE
- **Plan** — approved baseline, frozen at approval.
- **Actuals** — incoming AR/AP transactions.
- **LE (Latest Estimate)** — rolling output of plan + recon = actuals-to-date + adjusted forward plan over the full horizon. A **distinct object**, not "the edited plan."
- Reconciliation compares **Actuals vs baseline Plan** (same bucket, prorated); LE is the updated rolling view.

**Versioning**
- All plans are **version-controlled**.
- *Long-term:* exactly **one** plan can be **finalized/locked** as the plan of record (= the approved baseline); all others are **scenarios**.
- *MVP:* version control + a user-entered **"what changed" note** per version only. Finalize/lock + scenario machinery is deferred. `[TBD: approval mechanism.]`

## 8. Customization model
Everything customizable — settings, mappings, assumptions, input schema, workflow, engine logic, output — is **one kind of object**: a layered attribute carrying (a) scope/level, (b) provenance (ISO / gov / association / customer), (c) an override-vs-drift flag.
- **Resolution:** one engine over a layered store. **DECIDED: config-as-data** (differences expressed as data/formulas interpreted by one generic engine, not per-client code) — **provisional, "until proven wrong."** Rationale: the only option consistent with the single-resolver and drift-promotion principles. `[TBD: narrow, sandboxed code escape hatch for genuine one-offs — tagged as drift; hitting it is the "proven wrong" trigger.]`
- **MVP guardrail:** build only the thin engine SP's ph1 workflow needs, but never write `if customer == SP` branches — every SP-specific thing is data/formula from day one.
- **Drift → promotion:** one-offs are tagged and **promotable upward** (customer nuance → subgroup/industry standard) as a metadata move, not a rewrite.

## 9. Master data & mapping
- **Mapping scopes = the cascade levels:** truly-global (ISO — currency, country, UTC) / industry (port, region codes) / group–subgroup `[no example yet]` / customer (e.g. product ↔ family).
- **Approach:** define the thin **skeleton** first (primitive *types* + resolution/provenance mechanism), then extract **content** from SP, tagging scope as discovered. Do **not** author a global catalog speculatively.
- **Primitive types** `[draft]`: workflow, workflow step, fork(allocate|sum), link(sequential), component (input / output / logic-engine), mapping, assumption, window, template. `[Refine.]`

## 10. Phases
- **Planning:** demand-in → flows through the workflow steps, splitting at **allocate forks** → per-step P&L/cash → **consolidate**. `[TBD: whether top-down output targets exist and require plan-side reconciliation, vs. a pure forward pipeline.]`
- **Execution / Reconciliation:** actual AR/AP vs approved Plan → variance → LE update.

## 11. MVP — client SP (phased)
- **SP:** `Logistics ▸ Warehousing ▸ Fulfillment Center`.
- **Phasing** (this is the *plan*; the concrete workflow is in WORKFLOW.md `WF-001`, SP data in `client-sp/DESIGN.md`):
  1. **Phase 1 — top-down, demand-driven, no reconciliation, P&L + cashflow.** Warehouse asset + brokerage modeled as **one allocate fork** (asset = fixed + capex; brokerage = variable via GP%). Aggregated ballpark per the top-down principle (§5). **Direct-method** cashflow (P&L + timing; capex → cash only).
  2. **Phase 2 — bottom-up, demand-driven.**
  3. **Phase 3 — reconciliation** vs the Phase-2 (bottom-up) plan → LE.
- **Axis A held demand-driven** across the MVP; supply-driven / constrained windows deferred.
- Versioning per §7 (MVP level): version control + "what changed" note.
- MVP output feeds this SCOPE (promote generalizable elements; log drift).

## 12. Decisions / open items
- `[DECIDED — provisional]` Config-as-data (§8). Open sub-item: escape-hatch design.
- `[DECIDED]` Cashflow = **direct method** (P&L + timing) for MVP; full 3-statement deferred.
- `[DECIDED]` Allocation happens **at allocate-forks** (§3); ph1's is the asset/brokerage split. Per-fork rule form `[TBD detail]`.
- `[DECIDED]` Window is a **per-workflow-step** property (§6).
- `[DECIDED]` "segment" retired → workflow step / fork / consolidation.
- `[TBD]` Top-down output targets + plan-side reconciliation (§10).
- `[PARTIAL]` Versioning defined (§7); `[TBD]` finalize/lock + scenario machinery, approval mechanism.
- `[TBD]` Bottom-up demand: unit(s), entry point, demand→driver mapping (Phase 2).
- `[TBD]` Cost-behavior detail (fixed / semi-fixed / variable + drivers); "Office Variable" driver.
- `[TBD]` Supply-driven / constrained-window mechanics.
- `[TBD]` Governance files not yet created: CLAUDE.md, STYLE.md, BACKLOG.md (deferred until concrete).
