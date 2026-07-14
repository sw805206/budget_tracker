v001 | 2026-07-12

# BACKLOG.md — Master Budget

The project's tracker for important-but-not-urgent items. Source of truth for the backlog; items are flushed here word-for-word from the in-chat running block (per CLAUDE.md Part C). Nothing is committed until the user says so.

## Categories
- **process** — build/repo/workflow hygiene and conventions
- **feature** — new capability
- **page** — a screen / UI surface
- **bug** — defect
- **governance** — changes to governance docs (SCOPE, WORKFLOW, ARCHITECTURE, DATASET, etc.)
- **others** — anything not covered above

## Status
- **open** → **review** → **close** (normal flow)
- **park** — deferred indefinitely
- **discard** — dropped
- Code never self-closes: when Code thinks an item is done it moves it to **review**, not **close**.
- **close is human-only, and needs evidence** in Closed-by: the `PR##` for code, or the user's stated reason otherwise. Closed-by stays empty for any non-closed row.

## Schema
`| ID | Status | Category | Item | Raised | Closed-by |`
- **ID** — permanent `BL-###`, cumulative sequence, never reused.
- **Raised** — date the item was raised (yyyy-mm-dd).

## Backlog

| ID | Status | Category | Item | Raised | Closed-by |
|--------|--------|------------|------|------------|-----------|
| BL-001 | open | process | Add committed `.env.example` (placeholder `DATABASE_URL` etc.) so fresh clones/deploys know required env vars; `.env` stays git-ignored | 2026-07-12 | |
| BL-002 | open | process | Review the 2 moderate npm vulnerabilities from scaffold deliberately (assess breaking-change risk; don't `npm audit fix --force`) | 2026-07-12 | |
| BL-003 | open | governance | Update DATASET.md §6 relationship summary to list PlanStepSelection and PlanVersionAllocation (schema normalized them; doc omits them) | 2026-07-12 | |
| BL-004 | open | governance | Add to DATASET.md the enforced-in-app rules (version immutability once Published, one-plan-of-record-per-plan, entity-name duplicate-warning) so app-layer responsibilities are documented | 2026-07-12 | |
| BL-005 | open | governance | Update ARCHITECTURE.md: replace DBeaver reference with DB Browser for SQLite (DB4S) as the local DB viewer | 2026-07-12 | |
| BL-006 | open | governance | WORKFLOW.md §6 calls Currency a "placeholder (future), default USD" while DATASET.md §4 treats it as a mandatory field auto-satisfied by the USD default. Align the two: Currency is mandatory-but-auto-filled (USD) in Ph1, never blocks; future = currency table + exchange-rate table. Reconcile WORKFLOW §6 wording to DATASET §4. | 2026-07-13 | |
| BL-007 | open | process | Build the config-as-data directory (ARCHITECTURE §3/§7, DATASET §8 layout [TBD]) as a dedicated task, then migrate the Entity logic-bearing enums (Type, Payment Flow, Payment-Term anchors) — currently a temporary config-shaped constants file in the Entity feature — into it, along with the other intended tenants (WF-001 category/type catalog, cost-behavior rules, seasonality seed). Repoint the dropdown loader. | 2026-07-13 | |
| BL-008 | open | governance | Finalize DATASET §8 [TBD] "exact Prisma field types / constraints": record that the five mandatory Entity fields + currency are nullable at DB level (completeness enforced at UI/compute-gate, not schema), currency carries a DB-level `USD` default, and the two payment-term defaults (Statement, 30) are UI prefills not DB defaults. Set by the Entity Master Data feature. | 2026-07-13 | |
| BL-009 | open | process | npm vulnerabilities rose from 2 (scaffold, BL-002) to 5 moderate after adding Prisma 7 driver-adapter packages (@prisma/adapter-better-sqlite3, better-sqlite3). Review the 3 new ones deliberately (assess breaking-change risk; don't `npm audit fix --force`). Companion to BL-002, different origin. | 2026-07-13 | |
| BL-010 | open | governance | Record in ARCHITECTURE.md §2 that Prisma 7 is engine-less and requires a driver adapter: `@prisma/adapter-better-sqlite3` + `better-sqlite3` (native module) for SQLite now. Note that the future Postgres switch (§2 "near one-line") also entails swapping to a Postgres adapter — the adapter is part of the migration, not just the connection string. | 2026-07-13 | |
| BL-011 | close | feature | Entity archive/delete-with-usage (next branch after Entity CRUD). Add nullable `archivedAt` timestamp (migration). Single extensible `getEntityReferences(id)` seam — today checks RevenueAnnual + CostLine, structured so Phase 3 reconciliation tables slot in one place. Removal fork: references exist → Archive only (explained); zero references → Delete (warn irreversible); never hard-delete a referenced Entity. Unarchive in scope. List defaults to active + view-archived path. Archived entities excluded from pickers + duplicate-warning; existing references untouched; Published-plan outputs never affected (visibility-only, no cascade). | 2026-07-13 | PR#6 |
| BL-012 | open | governance | DATASET.md §4/§6 describe Entity as referenced by only RevenueAnnual (client) and CostLine (vendor), but the schema has FOUR FK paths into Entity: RevenueAnnual, SeasonalityWeight, OutputRevenueMonthly (all client, ON DELETE RESTRICT) and CostLine (vendor, ON DELETE SET NULL). Document all four in §6, and record the delete-behavior asymmetry: client references are DB-blocked (RESTRICT); vendor references are NOT DB-blocked (SET NULL silently orphans cost-line vendorIds), so the app-layer gate is the sole protection for vendor deletes. Related to BL-003 (§6 relationship-summary omissions). | 2026-07-13 | |
| BL-013 | open | page | Entity list-view polish: column selection (which fields to show), sorting, and filtering on the Active/Archived tabs. Deferred from the archive/delete feature — matters more once entity volume grows. Own pass. | 2026-07-13 | |
| BL-014 | open | feature | When pickers / inline entity creation exist (revenue client picker, cost vendor picker), exclude archived entities from those pickers and from the duplicate-name warning. Deferred sub-part of BL-011 (archive/delete) — could not be built in Ph1 as no pickers exist yet; carved out so BL-011 closes honestly for what shipped. | 2026-07-13 | |
