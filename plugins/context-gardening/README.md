# context-gardening

**Structured, agent-legible repository knowledge that Claude reads automatically — and that stays accurate as your code changes.**

---

## The Problem

Every new Claude Code session starts from zero. It doesn't know that your team uses service objects for business logic, that `/api/v2` routes follow a different auth pattern than v1, or that there's a wrapper around the Stripe client that must always be used instead of calling the SDK directly. So it re-reads source files to figure this out. It makes choices that drift from ones made in previous sessions. And the larger the codebase, the worse this gets — more context to know, less of it fits in a session.

The same problem is worse for autonomous, multi-step work. Without a record of what's been decided and why, long-running agents drift. They redo decisions. They hand off poorly between sessions.

**context-gardening solves both problems** by giving your codebase a structured memory — built once, kept accurate automatically, and read by Claude at the start of every session without any manual loading or prompting.

---

## How It Works: Progressive Disclosure

The core pattern is a **`CLAUDE.md` hierarchy** that exploits a native Claude Code behavior: when Claude navigates into a directory, it automatically reads any `CLAUDE.md` file present there — no configuration required, no prompting, no tool calls needed.

This makes it possible to structure context by scope:

- **Root `CLAUDE.md`** — kept under ~150 lines. Claude reads this at the start of every session. It's a navigation map — module inventory, key architectural decisions, links to docs. Not a style guide. It orients; it doesn't explain.
- **Module `CLAUDE.md` files** (e.g. `src/auth/CLAUDE.md`) — lazy-loaded by Claude Code the moment it navigates into that directory. Because they're not always in context, they can be thorough: canonical patterns with file references, key types, gotchas, testing conventions, what belongs and what doesn't. The goal is that a Claude session working in `src/auth/` can do excellent work without reading a single source file.
- **`docs/`** — the system of record for architecture, design decisions, execution plans, and product specs. Linked from root `CLAUDE.md`; loaded on demand.

The linter enforces this structure through git hooks. Six slash commands (skills) let Claude act as an agent to build and maintain it.

---

## Quickstart

Install the plugin (see [Installation](#installation)), then run once in any repository:

```
/context-gardening:init
```

Init scaffolds the full structure, generates context files by reading your actual source code, and installs git hooks — all in a single automated session. It finishes with a health check showing exactly what was created.

---

## Skills

Each command is a **Claude Code skill** — a `SKILL.md` file that Claude executes as a subagent. No external API calls, no SDK, no spawned processes. Claude itself is the agent.

| Command | What it does |
|---|---|
| `/context-gardening:init` | Read the repo, scaffold docs structure, generate all `CLAUDE.md` files, install git hooks |
| `/context-gardening:tend` | Diff code changes since last run, run lint checks, update stale docs, fix lint violations with full commit context |
| `/context-gardening:weed` | Find and interactively prune stale, orphaned, or misplaced docs |
| `/context-gardening:harmonize` | Migrate plans/specs from non-standard locations into `docs/execution-plans/` and `docs/product-specs/` |
| `/context-gardening:status` | Knowledge base health dashboard — linter summary, missing CLAUDE.md files, stale docs |
| `/context-gardening:scaffold-module <path>` | Generate a `CLAUDE.md` stub for a new module by reading its source files |

---

## What `/context-gardening:init` Does

Init is a multi-step subagent session. Here's the full sequence:

**Step 1 — Repo inspection.** Claude reads `package.json` / `pyproject.toml` / `go.mod`, lists top-level directories, and checks what already exists. It never overwrites files that are already present (unless you pass `--force`).

**Step 2 — Module detection.** Claude finds all `src/`, `app/`, `lib/`, `internal/` directories up to 3 levels deep, then identifies which of their subdirectories qualify for a module `CLAUDE.md` — any module with ≥10 source files.

**Step 3 — Docs scaffolding.** From templates in the plugin, Claude generates:
- `CLAUDE.md` — root nav map, filled with your actual repo name, stack, and module inventory
- `ARCHITECTURE.md` — domain map and package layering
- `docs/DESIGN.md`, `docs/SECURITY.md`, `docs/FRONTEND.md`, `docs/RELIABILITY.md`, `docs/QUALITY_SCORE.md`, `docs/PRODUCT_SENSE.md`
- `docs/design-docs/index.md`, `docs/design-docs/core-beliefs.md`
- `docs/product-specs/index.md`
- `docs/references/`, `docs/generated/` (empty, gitkeep'd)

Every generated file gets `<!-- garden-managed: auto -->` as its second line so the linter can distinguish auto-generated sections from human-maintained ones.

**Step 4 — Execution plans infrastructure.** Creates `docs/execution-plans/active/`, `docs/execution-plans/completed/`, `docs/execution-plans/tech-debt-tracker.md`, and `docs/PLANS.md` (the master catalogue). Skips if `docs/PLANS.md` already exists.

**Step 5 — Stray plan detection.** Scans `plans/`, `.agent/plans/`, `specs/`, `features/`, and any `.md` outside `docs/` that contains plan content signals (`## Progress`, `## Milestones`, `## Decision Log`, `## Implementation Plan`). If found, Claude uses the `AskUserQuestion` tool to present them as a multi-select and offers to migrate them into the standard structure. Anything not selected is left in place and can be migrated later with `/context-gardening:harmonize`.

**Step 6 — Module `CLAUDE.md` generation.** For each qualifying module, Claude reads 10–20 source files — prioritising entry points, files with many imports, and files whose names suggest core patterns (service, repository, handler, controller) — then writes a thorough module guide. This step runs to completion: init is not done until every qualifying module has a `CLAUDE.md`. The final linter check confirms this before reporting success.

**Step 7 — Linter and hook installation.** Copies linter scripts into `.garden/linters/`, git hooks into `.git/hooks/pre-commit` and `.git/hooks/pre-push` (both `chmod +x`'d), and adds `.garden/config.local.json` to `.gitignore`.

**Step 8 — Config.** Writes `.garden/config.json` using the actual `source_dirs` detected in Step 2, and creates `.garden/last-tended.json` to track tend state.

**Step 9 — Optional GitHub Actions.** Asks via `AskUserQuestion` whether to copy `github-actions/garden-ci.yml` to `.github/workflows/garden-ci.yml`.

**Step 10 — Verification.** Runs `node .garden/linters/run-all.js --status --json`. If there are any `module-claude-md-required` warnings, generates the missing files before reporting completion.

---

## The Knowledge Base Structure

```
CLAUDE.md                            ← nav map (~150 lines). Read at every session start.
ARCHITECTURE.md                      ← domain map and package layering
src/
  auth/
    CLAUDE.md                        ← auth module guide: patterns, types, gotchas. Lazy-loaded.
  payments/
    CLAUDE.md                        ← payments module guide. Lazy-loaded.
  api/
    CLAUDE.md                        ← REST conventions, error formats, testing. Lazy-loaded.
docs/
  DESIGN.md                          ← design philosophy and key decisions
  SECURITY.md                        ← security posture and threat model
  FRONTEND.md                        ← UI/UX conventions
  RELIABILITY.md                     ← SLOs and runbooks
  PLANS.md                           ← master catalogue of all active/completed/deferred plans
  execution-plans/
    active/                          ← in-flight ExecPlans (living documents, linter-enforced)
    completed/                       ← finished ExecPlans for posterity
    tech-debt-tracker.md
  product-specs/
    index.md                         ← spec catalogue
    <feature>.md                     ← individual product specs
  generated/
    db-schema.md                     ← auto-generated from ORM schema on each tend run
  design-docs/
    core-beliefs.md
.garden/
  config.json                        ← linter configuration (committed)
  config.local.json                  ← personal preferences, e.g. auto-accept (gitignored)
  last-tended.json                   ← SHA and timestamp of last tend run
  linters/                           ← copied from plugin on init
  hooks/                             ← hook helper scripts
```

---

## `/context-gardening:tend` — The Doc Gardener Agent

`/context-gardening:tend` is a full subagent session that keeps documentation accurate as code evolves. It accepts optional flags: `--dry-run`, `--pr`, `--since <date>`.

**What it does:**

1. Reads `.garden/last-tended.json` to find the last-tended git SHA. If null or `--since` was provided, uses the past 30 days.
2. Runs `git log <last_sha>..HEAD --name-only --oneline` to get changed files.
3. Maps changed files to candidate docs using path heuristics and any custom `source_doc_mappings` in `.garden/config.json`:
   - `src/<module>/` → `src/<module>/CLAUDE.md`
   - `*auth*, *oauth*, *jwt*, *session*` → `docs/SECURITY.md`
   - `*api*, *route*, *endpoint*, *controller*` → `docs/DESIGN.md`
   - `*component*, *ui*, *view*, *page*` → `docs/FRONTEND.md`
   - `*migration*, *schema*` → `docs/generated/db-schema.md`
   - `package.json`, `pyproject.toml`, `go.mod` → `ARCHITECTURE.md`
4. **Runs the pre-push lint suite** (`node .garden/linters/run-all.js --pre-push --json`) and folds every warning and error into the work queue as additional remediation tasks — merged and deduplicated with the diff-derived candidates. For each lint finding, tend also fetches the commits and diffs for the flagged files (`git log`/`git diff` scoped to those paths since the last SHA), so it has both the structural violation and the causal git history before deciding what to change. Lint-to-remediation mappings:
   - `claude-md-toc-sync` → add missing links to CLAUDE.md for the flagged files
   - `claude-md-length` → trim CLAUDE.md to bring it under the line limit
   - `freshness-marker` → update `<!-- last-reviewed: -->` in each stale doc
   - `cross-links` → fix each broken relative link
   - `plans-orphan` → add missing entries to `docs/PLANS.md`
   - `plans-active-structure` → add required sections to the flagged active plans
5. For each candidate doc (diff-derived or lint-derived): reads the doc and the relevant diff/commit context, then makes the minimum necessary update — preserving voice and structure, skipping `<!-- garden-managed: manual -->` sections, updating `<!-- last-reviewed: -->` markers.
6. Checks for newly created stray plan/spec files since the last tend and surfaces them via `AskUserQuestion`.
7. Regenerates `docs/generated/db-schema.md` from ORM schema files (supports Django, Rails, Prisma, Drizzle/TypeORM, SQLAlchemy).
8. Updates `.garden/last-tended.json` with the current HEAD SHA and appends a run summary to `docs/gardening-log.md`, including which lint violations were resolved vs. which remain.

With `--pr`, it commits the updates on a `garden/tend-<date>` branch and opens a PR via the `gh` CLI.

Run it weekly, or after significant changes. Use `--dry-run` to preview updates before they're written.

---

## Enforcement: Linters and Git Hooks

Five linter scripts run as git hooks. All are pure Node.js — zero npm dependencies, no `npm install` required.

**Pre-commit hook** (fast — staged files only):

| Check name | What it catches |
|---|---|
| `claude-md` | Root `CLAUDE.md` over line limit; broken links in `CLAUDE.md` |
| `module-claude-md` | Module directories with >10 files missing a `CLAUDE.md` |
| `doc-coverage` | Source files staged without any doc changes (configurable: `warn` or `error`) |
| `freshness-marker` | Docs whose `<!-- last-reviewed -->` date exceeds `freshness_warn_days` or `freshness_error_days` |
| `plans-misplaced` | Staged `.md` files in `plans/`, `specs/`, `features/`, or matching `*-plan.md` pattern |

**Pre-push hook** (thorough — full-tree scan):

| Check name | What it catches |
|---|---|
| `cross-links` | Broken relative links anywhere in `docs/` |
| `claude-md-toc-sync` | Docs not reachable from root `CLAUDE.md` |
| `plans-stray` | Any `.md` outside `docs/` with plan content signals — full-repo scan |
| `plans-catalogue-exists` | `docs/PLANS.md` absent |
| `plans-orphan` | Files under `docs/execution-plans/` not linked from `docs/PLANS.md` |
| `plans-active-structure` | Active plans missing `## Progress`, `## Decision Log`, or `## Outcomes & Retrospective` |

**Blocking vs. non-blocking:** `plans-active-structure`, broken links, and `claude-md` line limit violations are errors — they block the commit or push. Everything else is a warning. Warnings print but don't block.

**GitHub Actions** (optional, copy from `github-actions/garden-ci.yml`): runs the full pre-push suite on every PR.

---

## Interactive Remediation in Claude Code

When a linter error blocks a `git commit` or `git push` inside a Claude Code session, the pre-commit hook writes a JSON payload to `stderr` that the plugin's `UserPromptSubmit` hook intercepts. Claude then uses the `AskUserQuestion` tool to surface an interactive prompt instead of a raw error:

> *Garden linter found 2 error(s). What would you like to do?*
> - Run `/context-gardening:harmonize` — move misplaced plan/spec files into `docs/`
> - Run all applicable fixes
> - Skip for now (commit stays blocked)
> - **Auto-accept fixes on future commits/pushes — run now and save preference**

Selecting a fix causes Claude to invoke the relevant skill, then offer to re-commit. **Auto-accept** saves `{"auto_accept_fixes": true}` to `.garden/config.local.json` (gitignored — personal, never committed), so future commits silently run fixes without prompting.

To reset auto-accept:

```bash
rm .garden/config.local.json
# or: echo '{"auto_accept_fixes": false}' > .garden/config.local.json
```

**Outside Claude Code** (terminal `git commit`): the hook outputs copy-pasteable fix commands instead:

```
Garden linter: 1 error(s) found.

  ✗ plans-misplaced: plans/feat-auth.md should live in docs/execution-plans/

To fix, open a Claude session or run:
  claude -p "/context-gardening:harmonize"
```

---

## Execution Plans (ExecPlan Format)

Plans are first-class artifacts. `docs/PLANS.md` is the master catalogue — every plan has a row in it. Complex, multi-session work lives in **ExecPlans** under `docs/execution-plans/active/`.

The ExecPlan format is a direct implementation of the [OpenAI Codex ExecPlan spec](https://developers.openai.com/cookbook/articles/codex_exec_plans). The `plans-active-structure` linter check enforces that every active plan contains:

```markdown
## Progress
- [x] Step one — done
- [ ] Step two — in progress

## Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-07 | Use optimistic locking for concurrent edits | Avoids lock contention under read-heavy load |

## Outcomes & Retrospective
<!-- Written at completion, before moving to docs/execution-plans/completed/ -->
```

When a Claude session picks up an in-flight ExecPlan, it reads the current `## Progress` state and `## Decision Log` and continues coherently — no ramp-up, no repeated decisions. When the work is done, the plan moves to `docs/execution-plans/completed/` and `docs/PLANS.md` is updated accordingly.

Known technical debt goes in `docs/execution-plans/tech-debt-tracker.md`, not in ad-hoc comments or open issues.

---

## Freshness Markers

Docs opt into staleness tracking with an HTML comment:

```markdown
<!-- last-reviewed: 2026-03-07 -->
```

The linter warns when the date is older than `freshness_warn_days` (default: 30) and errors when older than `freshness_error_days` (default: 90). `/context-gardening:tend` updates this marker when it makes changes.

To mark sections as human-maintained (the gardener will skip them):

```markdown
<!-- garden-managed: manual -->
This section is maintained by hand. The gardener won't touch it.
<!-- garden-managed: auto -->
```

---

## Configuration

`.garden/config.json` is created by `/context-gardening:init`, pre-populated with your actual `source_dirs`. All fields are optional — the defaults work for most repos.

```json
{
  "version": "1",
  "claude_md_max_lines": 150,
  "module_md_max_lines": 750,
  "module_md_required_above_file_count": 10,
  "freshness_warn_days": 30,
  "freshness_error_days": 90,
  "doc_coverage_mode": "warn",
  "source_dirs": ["src", "app", "lib"],
  "generated_docs": ["docs/generated/db-schema.md"],
  "ignore_paths": ["node_modules", ".git", "dist", "build"],
  "plans": {
    "cataloguePath": "docs/PLANS.md",
    "activePath": "docs/execution-plans/active",
    "ignore": []
  },
  "source_doc_mappings": []
}
```

`source_doc_mappings` lets you define custom file-pattern → doc-file rules for `/context-gardening:tend`:

```json
"source_doc_mappings": [
  { "pattern": "src/billing/**", "doc": "docs/BILLING.md" },
  { "pattern": "infra/**", "doc": "docs/RELIABILITY.md" }
]
```

`.garden/config.local.json` (gitignored) stores personal preferences like `auto_accept_fixes`.

---

## Installation

### Option 1 — Claude Code Marketplace (recommended)

```
/plugin marketplace add william-c-stanford/closed-loop-saas
/plugin install context-gardening@closed-loop-saas
```

### Option 2 — Install directly from GitHub

```bash
git clone https://github.com/william-c-stanford/closed-loop-saas.git ~/claude-plugins/closed-loop-saas
```

Add to `~/.claude/settings.json`:

```json
{
  "plugins": [
    {
      "path": "~/claude-plugins/closed-loop-saas/plugins/context-gardening"
    }
  ]
}
```

### Option 3 — Fork and self-host

Fork this repo, adjust linter thresholds, add custom skills, or extend the templates for your team's conventions. Point your `settings.json` at your fork. No build step — all skills are SKILL.md files, all linters are Node.js built-ins.

---

## Dependencies

**Zero runtime dependencies for AI features** — Claude Code is the AI layer. The skills are SKILL.md prompt files; Claude executes them.

**Linters** use only Node.js built-ins (`fs`, `path`, `child_process`). No `npm install` required.

**Optional:**
- `node` ≥18 — required for git hooks and linters
- `gh` CLI — required for `/context-gardening:tend --pr`

---

## Background

This plugin operationalizes two specific pieces of engineering thinking about AI agent productivity.

**[Execution Plans for Codex](https://developers.openai.com/cookbook/articles/codex_exec_plans)** (OpenAI Developer Cookbook) introduced the ExecPlan format — structured living documents with `## Progress`, `## Decision Log`, and `## Outcomes & Retrospective`. The insight: agents doing long-horizon work need verifiable checkpoints, not just instructions. Without them, they drift. The `plans-active-structure` linter check enforces this format on every active plan.

**[Harness Engineering with AI](https://openai.com/index/harness-engineering/)** (OpenAI) shows what happens when an engineering team restructures their codebase for AI legibility at scale. Productivity gains from AI agents are bounded by how well the codebase explains itself. The `AGENTS.md` (here, `CLAUDE.md`) hierarchy in that work — root nav map, lazy-loaded module guides — is what this plugin implements and enforces.

The core premise: **a codebase's documentation is not just for humans — it is the primary input surface for AI agents working in it.** Keeping that surface accurate, scoped, and continuously maintained is an engineering discipline. context-gardening is the tooling that makes it sustainable.
