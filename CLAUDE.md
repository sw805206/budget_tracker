last updated: 2026-07-05

# Working Rules

These are the universal working rules.

Tiers of process, by ownership:

- **CLAUDE.md** — universal human/Claude working rules, apply to every project (lives in MOTHERSHIP, synced down). Part A behavioral + Part B code discipline + Part C shared processes.
- **process.md** — project-specific human/Claude processes. Not universal; lives in the project repo only.
- **Google Doc SOP** — 100%-human processes. User reference, not source of truth.

In this file (CLAUDE.md) they are structured as:

- **Part A** — Global Chat Behavioral — paste to Claude Global Setting
- **Part B** — Global Chat/Code Discipline for Coding Projects
- **Part C** — Global Human/Claude Processes

This master copy lives in the User's MOTHERSHIP folder; then re-sync the repo copy and re-paste Part A into Claude settings.

Each project's type, required governance docs, and branch/PR discipline are declared in its own SCOPE.md (guided by human SOP) — read SCOPE.md first to know where the project sits.

## Part A — Behavioral (applies to all work)

**Read the governance files first.** At the start of a task, read the project's governance docs — CLAUDE.md and SCOPE.md, plus STYLE.md if STYLE.md says style is in play. If a required governance file is missing, stop and ask before doing any work.

**The repo is the source of truth.** The committed/merged repo (git main) is authoritative — not any other conversation, not memory, not an attached or synced copy. If attached/synced project files, or claims about what was decided in another chat, conflict with the repo, flag the conflict, stop, and ask before proceeding.

**Discussion mode by default.** Do not write prompts, code, or files until I explicitly say so (e.g. "write it now"). Until then, stay in discussion mode: ask questions, surface tradeoffs, and refine the thinking with me. Writing before I'm ready breaks my thought process.

**Match the mode.** Not every chat is about coding. Do not default to coding-oriented output unless the chat is actually about building or modifying code. If you're unsure which mode we're in, ask before proceeding.

**Don't guess.** If something is missing, ambiguous, or you're unsure, stop and ask. Never guess at a file's contents, a convention, or my intent. When you agree with my proposals, rewrite them to be more concise and accurate — do not revert to your original phrasing in a way that contradicts or drifts from my intention. If you agree, your write-up must reflect my meaning; if you still see a genuine problem with my version, say so explicitly rather than quietly changing the wording back.

**Ask for content first.** If I say I'm sending you content but nothing is attached, assume I may have hit send before attaching it. Stop and ask for the content — do not fill the gap with a speculative or elaborated response until I've provided it.

**Be concise and direct.** Keep responses focused. Push back when you disagree — don't just agree to be agreeable.

**Prompts are for Claude Code.** When I ask for a prompt to run, write it for Code to execute — clear, scoped, and based on what we discussed. I will review it before running. Always put it in a code block so I can copy-paste it directly.

**Wait for the go before drafting.** When a decision is pending my input, stop at your recommendation and wait. Do not draft the runnable prompt (or code, or file) until I explicitly say go — even if the discussion feels complete. Surfacing options and giving a recommendation is always fine; producing the deliverable waits for my word.

**Post-merge cleanup — I remind, so you don't have to.** After any PR merges, I track that a cleanup is due and surface it automatically — you never have to remember it. But I never provide cleanup on the assumption a merge happened: I first confirm the merge actually landed on main (via `git log` showing the merge commit, or you confirming GitHub shows it merged). The sequence is always four distinct steps — push → open PR → merge PR → cleanup — and cleanup is gated on the third being confirmed. Once confirmed, I provide the standard cleanup block (see Part B → Protect main) with the merged branch name filled in. If a merge isn't yet confirmed, I say so and hold the cleanup rather than run it early.

**Backlog.** The backlog is the project's tracker for process, feature, page, bug, or governance changes. Follow the operational procedure in Part C → *how-to: maintain the backlog*.

## Part B — Code discipline (coding projects only)

These rules apply only when SCOPE.md indicates the project involves coding. If the project does not involve coding, ignore Part B.

**Protect main when it deploys from main.** If the project deploys from main (live website or app), never commit directly to main: one feature branch per task, branched from an up-to-date main → commit locally as you work → push the branch to remote → open a PR only when I ask → merge → delete the branch. If the project does not deploy from main (research, content/data), committing directly to main is fine; branch only when you want isolation for risky work. Post-merge cleanup (run only after the merge is confirmed on main — see Part A → Post-merge cleanup): run `git checkout main`, then `git pull origin main`, then `git branch -d <branch>`, then `git remote prune origin`. This syncs main, deletes the merged local branch (safe `-d` refuses if unmerged), and prunes the stale remote ref. Never run it before the merge is confirmed landed.

**No PR unless I explicitly ask.** When I do ask, name it `type/short-description`, where type is one of: feat, fix, docs, refactor, chore, style, test, perf, build, ci, uat.

**Style changes are committed separately.** When a UI/UX decision is finalized and applies project-wide (not a one-off), ask whether STYLE.md and/or STYLE.css should be created or updated. Any change to STYLE.md or STYLE.css must be committed on its own — never mixed into other code changes.

**Show client-facing changes on localhost.** When edits are client-facing UI or UX changes (style, content, layout, flow), launch localhost first so I can see them before they're committed.

## Part C — Global Human/Claude Processes

### how-to: maintain the backlog | last update: 2026-07-05

Backlog is a universal, standard practice — it tracks both short-term items (bugs, UI improvements) and long-term ones (big features, new apps). This how-to is the operational procedure; the governing rule is Part A → Backlog, and the definition (categories, status semantics) is the BACKLOG.md header.

**Process vs. artifact.** A process defined here is global — the same procedure applies to every project. The *artifact* it operates on is per-project and lives in that project's repo. The backlog is the canonical example: the how-to (Part C) is global and identical everywhere, but each project keeps its own `BACKLOG.md`. One shared process, one backlog file per project — they never merge across projects.

#### The two states

The backlog lives in two places, and the distinction is the whole system:

- **The running block** — a live tally *in chat*. Temporary, uncommitted, holds items as they're raised during a session.
- **BACKLOG.md** — the source of truth *in the repo*. Permanent, committed (when the user says so).

Items flow one direction: raised in chat → held in the running block → flushed to BACKLOG.md.

#### Maintaining the running block (in chat)

- **User says "log to backlog."** That's the trigger. Chat adds the item to the running block.
- **The block reprints in full every time it changes.** Not the new row alone — the entire block, every time. The latest printing is always the complete, authoritative list. This is deliberate: the user never needs to reassemble rows scattered up the conversation.
- **Temp IDs are `P01`, `P02`, …** — scoped to the current unflushed batch only. They're not permanent. After a flush, the block empties and P## recycle from P01.

So during a session the running block just accumulates P-rows until the user decides to flush.

#### Flushing to BACKLOG.md

- **User requests the flush.** (Nothing flushes automatically.)
- **It's a word-for-word copy, verified by count** — N pending rows in the block = N new rows out to BACKLOG.md. The count check is the guard against dropped or duplicated rows.
- **P## become permanent `BL-###`** — assigned in cumulative sequence, continuing from the last BL number in the file (never reused, never recycled).
- **Tags and status are assigned at flush** (or edited later via Code): a **Category** (process, feature, page, bug, governance, or others) and a **Status** (`open → review → close`, or `park`/`discard`).
- **The flush writes to the working tree only — never committed until the user says so.** A flush and a commit are two separate steps.

#### The status rules that bite

- **Code never self-closes.** When Code thinks an item's done, it moves it to `review`, not `close`.
- **Close is human-only, and needs evidence.** The user ratifies, and the closed row must carry proof in **Closed-by**: the `PR##` for code, or the user's stated reason otherwise. Closed-by stays empty for any non-closed row.

#### The schema

```
| ID | Status | Category | Item | Raised | Closed-by |
```

The running block uses the same columns, with a `P##` in the ID slot (Closed-by empty until flush/close).
