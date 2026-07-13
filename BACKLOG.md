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
