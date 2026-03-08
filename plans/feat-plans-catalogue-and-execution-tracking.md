# Add PLANS.md catalogue and execution-plans tracking infrastructure

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `plans/` directory at repo root. This document must be maintained in accordance with the ExecPlan specification described in the OpenAI Codex PLANS.md article (embedded in this plan below).


## Purpose / Big Picture

When users install this plugin in their repos via `/garden:init`, there is currently no plan-tracking infrastructure: no catalogue, no lifecycle directories, and no linter checks for plan completeness. Complex multi-step work has no canonical home.

After this change, every repo scaffolded by `/garden:init` will get `docs/PLANS.md` as a master catalogue, `docs/execution-plans/active/` and `docs/execution-plans/completed/` as lifecycle directories, and `docs/execution-plans/tech-debt-tracker.md` for deferred items. The linter will check plan health at pre-push/CI time. The `CLAUDE.md` template will cross-link to `docs/PLANS.md` so agents always have a path to find active work.

The observable outcomes: running `node .garden/linters/run-all.js --status` in a newly scaffolded target repo will include `plans-catalogue-exists`, `plans-orphan`, and `plans-active-structure` checks; the scaffolded `docs/PLANS.md` file will be ready for a team to start adding plans immediately.


## Progress

- [x] (2026-03-07) Add `templates/docs/PLANS.md.md` template
- [x] (2026-03-07) Add `templates/docs/execution-plans/tech-debt-tracker.md.md` template
- [x] (2026-03-07) Update `templates/CLAUDE.md.md` to add `docs/PLANS.md` row in the Documentation Index table
- [x] (2026-03-07) Create `linters/check-plans.js` linter script
- [x] (2026-03-07) Wire `check-plans.js` into `linters/run-all.js` (pre-push / CI / status modes)
- [x] (2026-03-07) Update `.garden/config.schema.json` with optional `plans` config block
- [x] (2026-03-07) Update `skills/init/SKILL.md` to scaffold `docs/execution-plans/active/`, `docs/execution-plans/completed/`, and write the two new templates into the target repo
- [x] (2026-03-07) Validate: simulated scaffold confirms all three plan checks pass; orphan and structure error paths verified


## Surprises & Discoveries

_Populated during implementation._

- Observation: …
  Evidence: …


## Decision Log

- Decision: Place the catalogue at `docs/PLANS.md`, not `PLANS.md` at root.
  Rationale: The OpenAI article's directory layout shows `PLANS.md` inside `docs/`. Keeping it there is consistent with every other tracking doc in the scaffolded structure (`DESIGN.md`, `SECURITY.md`, etc.) and ensures the cross-link linter already knows where to look.
  Date/Author: 2026-03-07

- Decision: Do not modify this plugin repo's own `plans/` directory — scope is templates + linter + init skill only.
  Rationale: User confirmed Areas 2–4 are in scope; Area 1 (restructuring this plugin repo itself) is out of scope.
  Date/Author: 2026-03-07

- Decision: `check-plans.js` runs at `--pre-push`, `--ci`, and `--status` modes only, not pre-commit.
  Rationale: Plan files are not edited on every commit. Running a deep structural check at pre-commit would create friction for commits that don't touch plans at all. The cross-links linter follows the same pattern.
  Date/Author: 2026-03-07


## Outcomes & Retrospective

Completed 2026-03-07. All three areas delivered: two templates, CLAUDE.md template update, `check-plans.js` linter with three checks (catalogue-exists, orphan, active-structure), schema extension, and init skill Step 4b. Validation confirmed all happy-path and error-path behaviours via simulated scaffold. No surprises encountered — the pattern from `check-cross-links.js` translated directly.


## Context and Orientation

This repo (`/Users/williamstanford/context-gardening`) is a Claude Code plugin. It does not contain application code — it contains templates, linters, git hooks, and skills that are installed into target repos. Key paths:

- `linters/run-all.js` — orchestrator that imports and runs all check functions; this is what git hooks call
- `linters/check-cross-links.js` — example of a linter module that exports `checkCrossLinks(repoRoot, config)` and returns an array of `{check, status, message, detail}` objects
- `templates/CLAUDE.md.md` — the root `CLAUDE.md` template, uses `{{PLACEHOLDER}}` syntax
- `templates/docs/DESIGN.md.md` — example doc template
- `skills/init/SKILL.md` — the `/garden:init` skill; describes how the AI agent scaffolds a target repo step by step
- `plans/feat-context-gardening-claude-code-plugin.md` — the one existing plan; 807 lines; currently not indexed anywhere

The linter result object shape, as seen in `check-cross-links.js`:

    { check: 'cross-links', status: 'ok'|'warn'|'error', message: '...', detail: '...' }

The `run-all.js` orchestrator includes results from `checkCrossLinks` only when `mode` is `pre-push`, `ci`, or `status`. New linters follow this same gating pattern.

The `.garden/config.json` schema (at `.garden/config.schema.json`) defines optional config fields. If a new linter needs a config escape hatch (e.g., `plans.ignore`), it should be added to the schema.

An "ExecPlan" (used throughout this document) means a plan file that follows the skeleton defined in the OpenAI PLANS.md article. The skeleton requires these sections at minimum: Purpose/Big Picture, Progress (checkboxes), Surprises & Discoveries, Decision Log, Outcomes & Retrospective, Context and Orientation, Plan of Work, Concrete Steps, Validation and Acceptance.


## Plan of Work

The work divides into three areas: templates, linter, and skill update. Each is independently committable.

**Area 1 — Templates (so target repos get this structure)**

Add `templates/docs/PLANS.md.md` — a template version of the catalogue with `{{PLANS_TABLE_ROWS}}` placeholder rows. Add `templates/docs/execution-plans/tech-debt-tracker.md.md` — a template stub for the tech debt tracker. Update `templates/CLAUDE.md.md` to add a `docs/PLANS.md` row in the Documentation Index table (currently has six rows; add a seventh: `[docs/PLANS.md](./docs/PLANS.md) | Plans catalogue and execution tracking`).

**Area 2 — Linter**

Create `linters/check-plans.js`. This script exports `checkPlans(repoRoot, config)`. It performs three checks:
1. `plans-catalogue-exists`: warns if `docs/PLANS.md` is absent (not an error — projects may opt out)
2. `plans-orphan`: for every `.md` file under `docs/execution-plans/`, check whether `docs/PLANS.md` contains a link to it; warn on any that are not linked
3. `plans-active-structure`: for every `.md` file under `docs/execution-plans/active/`, verify it contains the required living-document section headings (`## Progress`, `## Decision Log`, `## Outcomes & Retrospective`); emit an error for any that are missing required sections

Wire `check-plans.js` into `run-all.js`: import it at the top, then in the `if (mode === 'pre-push' || mode === 'ci' || mode === 'status')` block, push `...checkPlans(repoRoot, config)` to `allResults`.

**Area 3 — Init skill update**

Edit `skills/init/SKILL.md` to add a step that creates `docs/execution-plans/active/` and `docs/execution-plans/completed/` directories, copies `templates/docs/execution-plans/tech-debt-tracker.md.md` to `docs/execution-plans/tech-debt-tracker.md`, and copies `templates/docs/PLANS.md.md` to `docs/PLANS.md` with the placeholder rows populated as empty (no plans yet). The step should come after the existing step that creates `docs/`.


## Concrete Steps

All commands run from the plugin repo root (`/Users/williamstanford/context-gardening`) unless noted otherwise.

**Step 1 — Create templates/docs/PLANS.md.md**

Create the file at `templates/docs/PLANS.md.md` with the catalogue template content. See the Artifacts section for the exact content.

**Step 2 — Create templates/docs/execution-plans/tech-debt-tracker.md.md**

Create `templates/docs/execution-plans/tech-debt-tracker.md.md`. This directory does not yet exist; create it first. See the Artifacts section for the exact content.

**Step 3 — Update templates/CLAUDE.md.md**

In `templates/CLAUDE.md.md`, locate the Documentation Index table and add a new row:

    | [docs/PLANS.md](./docs/PLANS.md) | Plans catalogue — active, completed, and deferred work |

**Step 4 — Create linters/check-plans.js**

Create the file following the interface in the Interfaces and Dependencies section below.

**Step 5 — Wire check-plans into run-all.js**

In `linters/run-all.js`:
- Add `const { checkPlans } = require('./check-plans');` alongside the other requires at the top
- In the `if (mode === 'pre-push' || mode === 'ci' || mode === 'status')` block, add `allResults.push(...checkPlans(repoRoot, config));`

**Step 6 — Update .garden/config.schema.json**

Add the optional `plans` object to the schema. See the Interfaces section for the exact shape.

**Step 7 — Update skills/init/SKILL.md**

Find the step in `skills/init/SKILL.md` that describes creating the `docs/` directory and its template-based children. Add instructions immediately after to:
- Create `docs/execution-plans/active/` and `docs/execution-plans/completed/` subdirectories
- Write `docs/execution-plans/tech-debt-tracker.md` by filling in `templates/docs/execution-plans/tech-debt-tracker.md.md` with `{{DATE}}` replaced by the current date
- Write `docs/PLANS.md` by filling in `templates/docs/PLANS.md.md` with `{{PLANS_ACTIVE_ROWS}}` and `{{PLANS_COMPLETED_ROWS}}` replaced by `_No plans yet._`
- Note that the Documentation Index in `CLAUDE.md` now includes a `docs/PLANS.md` row (already handled by the CLAUDE.md template update in Step 3)

**Step 8 — Validate**

Scaffold a test repo using `/garden:init` (or simulate by running the linter directly in a directory that has the generated `docs/PLANS.md`). Run:

    node linters/run-all.js --status

Expected output includes:

      OK   plans-catalogue-exists         docs/PLANS.md found
      OK   plans-orphan                   All plans linked from docs/PLANS.md
      OK   plans-active-structure         All active plans have required sections

Also run with `--json` to confirm the three entries appear in JSON output:

    node linters/run-all.js --status --json


## Validation and Acceptance

In a fresh test directory, simulate a scaffolded repo by creating `docs/PLANS.md` (from the template with empty rows) and `docs/execution-plans/active/` (empty). Run `node linters/run-all.js --status` from that directory pointing at the plugin linters. All three checks — `plans-catalogue-exists`, `plans-orphan`, `plans-active-structure` — must show `OK`.

Add a plan file to `docs/execution-plans/active/test-plan.md` that is missing the required headings. Re-run; `plans-active-structure` must show `ERR` with the filename in the detail.

Add a plan file to `docs/execution-plans/active/test-plan.md` that has all three required headings but is not linked from `docs/PLANS.md`. Re-run; `plans-orphan` must show `WARN`.

Run `node linters/run-all.js --status --json` and confirm all three check entries appear in the JSON array.


## Idempotence and Recovery

All steps are purely additive (new files + two edits). Every file creation step is safe to re-run. The `run-all.js` and `skills/init/SKILL.md` edits are safe to re-apply — check whether the lines are already present before inserting. To roll back: delete the two new template files, revert `templates/CLAUDE.md.md`, remove the `checkPlans` lines from `run-all.js`, remove the `plans` block from `config.schema.json`, and revert the init skill.


## Artifacts and Notes

`templates/docs/PLANS.md.md` — exact content to write:

    # Plans

    <!-- garden-managed: manual -->
    <!-- last-reviewed: {{DATE}} -->

    Master catalogue of all plans in this repository. Detailed execution plans live in
    `docs/execution-plans/`. Status values: Active, Completed, Deferred.

    ## Active

    | Plan | Status | Started | Summary |
    |---|---|---|---|
    {{PLANS_ACTIVE_ROWS}}

    ## Completed

    | Plan | Status | Completed | Summary |
    |---|---|---|---|
    {{PLANS_COMPLETED_ROWS}}

    ## Technical Debt

    See [execution-plans/tech-debt-tracker.md](execution-plans/tech-debt-tracker.md) for deferred items.

When `/garden:init` runs, substitute `_No plans yet._` for both `{{PLANS_ACTIVE_ROWS}}` and `{{PLANS_COMPLETED_ROWS}}`.

`templates/docs/execution-plans/tech-debt-tracker.md.md` — exact content to write:

    # Technical Debt Tracker

    <!-- garden-managed: manual -->
    <!-- last-reviewed: {{DATE}} -->

    Known technical debt items that are deferred but not forgotten. Add an entry here when
    deferring work from an active ExecPlan.

    | ID | Area | Description | Severity | Linked Plan |
    |---|---|---|---|---|
    | (none yet) | — | — | — | — |


## Interfaces and Dependencies

`linters/check-plans.js` must export exactly one function:

    module.exports = { checkPlans };

    function checkPlans(repoRoot, config) {
      // Returns: Array<{ check: string, status: 'ok'|'warn'|'error', message: string, detail?: string }>
    }

The three check names (used as the `check` field in result objects) are:

- `'plans-catalogue-exists'`
- `'plans-orphan'`
- `'plans-active-structure'`

The required section headings for active plans (used in `plans-active-structure`) are:

- `## Progress`
- `## Decision Log`
- `## Outcomes & Retrospective`

No new npm dependencies are permitted. The script must use only Node.js built-ins (`fs`, `path`).

The `.garden/config.schema.json` should gain an optional `plans` object:

    "plans": {
      "type": "object",
      "properties": {
        "cataloguePath": { "type": "string", "default": "docs/PLANS.md" },
        "activePath":    { "type": "string", "default": "docs/execution-plans/active" },
        "ignore":        { "type": "array", "items": { "type": "string" } }
      }
    }

This allows a project that keeps plans in a non-standard location to configure `check-plans.js` without modifying the linter.
