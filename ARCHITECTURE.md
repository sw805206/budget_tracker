v0.1 | 2026-07-12

# ARCHITECTURE.md — Master Budget

Status: working draft. Records the technical stack and structural seams for the MVP. Governed by SCOPE.md (v0.6) and WORKFLOW.md WF-001 (v0.3). The stack is chosen to (a) ship MVP Phase 1 fast, (b) run locally at $0 now and lift to a server later with no rewrite, and (c) keep the config-as-data seams open for the future multi-customer branch model.

## 1 — Guiding constraints
- **One language end-to-end.** Frontend and backend are both TypeScript, so there is no cross-language boundary to reason across. (Chosen because the owner does not debug code; fewer moving parts = fewer dead-ends for Claude Code.)
- **Mainstream, Code-fluent choices.** Every dependency is a widely-used default that Claude Code handles well.
- **Local now, hosted later, same code.** The app runs on `localhost` during MVP and deploys to a host later without a rewrite.
- **Seams over features.** Build only what Phase 1 needs, but place the boundaries (engine, config) so the config-as-data future is possible without forking (SCOPE §13).

## 2 — Stack (decided)
- **Language:** TypeScript (frontend + backend).
- **Framework:** Next.js (single app: UI + server routes).
- **Database (local):** SQLite — a single file in the repo (e.g. `prisma/dev.db`). $0, zero setup.
- **Database (hosted, later):** PostgreSQL. The SQLite → Postgres switch is a configuration change, not a rewrite.
- **Database layer (ORM):** Prisma — talks to SQLite now and Postgres later through the same code; makes the switch near one-line.
- **Charts:** Recharts (React charting for the numbers + graphs in WF-001 §5).
- **Repo:** a single Next.js app inside `budget_tracker/`, alongside the governance docs (`SCOPE.md`, `WORKFLOW.md`, this file) and `client-sp/`.

## 3 — Structural seams (load-bearing)
These boundaries are the reason the trunk can later host branches without forking. They are required, not optional.

- **Canonical dataset = the contract.** A single normalized internal representation of a plan (clients, revenue, cost lines, timing, cash). Defined in DATASET.md (next document). The engine reads it; the UI/database write it.
- **Engine = isolated TypeScript module.** All computation — seasonality gross-up (WF-001 §3.5.1), revenue allocation at forks, EBITDA (Revenue − COGS − OPEX), cashflow (pure cash timing, incl. CAPEX/Tax) — lives in a standalone module that takes the canonical dataset in and returns results. It does **not** import UI or database code. This keeps the expensive logic fork-free (SCOPE §5, §2a).
- **Input adapters normalize to canonical.** Top-down (Phase 1) and bottom-up (Phase 2) are separate input paths that both produce the same canonical dataset. The engine never knows which produced its input (SCOPE §6).
- **Config-as-data directory.** Standard values — default seasonality seed, the WF-001 category/type catalog, cost-behavior rules, defaults — live as **data files in a config directory**, not hardcoded in logic and not (yet) a full rules engine. A future branch is "a different config bundle," not a code change. No `if customer == SP` branches anywhere (SCOPE §13).

## 4 — Data & git hygiene
- **Schema is code, data is not.** The Prisma schema (database structure) is committed to git. The SQLite data file (`dev.db`) is the owner's working data and is **git-ignored** — never committed.
- **DBeaver:** the local SQLite file can be opened directly in DBeaver (point it at the `.db` file — no host/port/password needed).
- **Backup (local):** copy the `.db` file.

## 5 — How to run it locally
> These commands are filled in when Claude Code scaffolds the app. Placeholders shown; the exact commands will be confirmed at scaffold time and updated here.

Prerequisites (one-time):
- Node.js installed (Claude Code will confirm the version).
- Dependencies installed: `npm install`

Everyday use:
1. Start the app:
   ```
   npm run dev
   ```
2. Open the app in a browser:
   ```
   http://localhost:3000
   ```
3. Stop the app: press `Ctrl-C` in the terminal.

Database (first-time setup / after schema changes), via Prisma:
- Apply the schema to the local SQLite file:
  ```
  npx prisma migrate dev
  ```
- (Optional) open Prisma's data viewer:
  ```
  npx prisma studio
  ```

`[Claude Code to confirm/replace these with the exact project commands at scaffold time.]`

## 6 — Deferred (not in MVP Phase 1)
- **Auth / login** — deferred to V1 (SCOPE §14).
- **Hosting / deployment** — decided later; app is local-only for MVP. Postgres migration happens at that point.
- **Data schema detail** — lives in DATASET.md (the next document), not here.
- **Bottom-up per-step engines** (input/output/conversion/logic per step) — Phase 2 (SCOPE §6, §14).
- **Multi-currency / i18n** — Account settings default (USD / en) for Ph1/V1; selection + conversion later (SCOPE §11).

## 7 — Open items
- `[TBD]` Exact scaffold commands and Node version (fill §5 at scaffold time).
- `[TBD]` Config directory layout (finalize when DATASET.md is written).
- `[TBD]` Where the engine module boundary sits relative to Next.js server routes (confirm at scaffold).

## 8 — Changelog
- **v0.1 (2026-07-12):** Initial architecture. Stack decided: TypeScript / Next.js / SQLite-local → Postgres-hosted / Prisma / Recharts, single repo. Recorded structural seams (canonical dataset, isolated engine, input adapters, config-as-data), git/data hygiene, DBeaver access, local run instructions, and deferred items.
