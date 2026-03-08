# context-gardening

A Claude Code plugin for agent-legible repository knowledge management.

Implements **progressive disclosure** for repository knowledge:

- **Root `CLAUDE.md`** — a navigation map only (~100–150 lines). Loaded at every session start, so it must stay short. Points to everything else.
- **Module `CLAUDE.md` files** — thorough local style guides. Loaded by Claude Code *only* when it navigates into that directory. No brevity pressure — they should be as complete as needed to let an agent or contributor work confidently in that module without re-reading source files.
- **`docs/`** — the system of record for architecture, design decisions, plans, and product specs.

---

## The Pattern

```
CLAUDE.md              ← map/TOC only (~100-150 lines). Read by Claude at every session start.
ARCHITECTURE.md        ← domain map and package layering
src/
  auth/CLAUDE.md       ← thorough auth style guide: patterns, types, gotchas. Lazy-loaded when needed.
  api/CLAUDE.md        ← thorough API guide: REST conventions, error formats, testing approach.
docs/
  DESIGN.md            ← design philosophy
  SECURITY.md          ← security posture
  RELIABILITY.md       ← SLOs and runbooks
  PLANS.md             ← plans catalogue (active, completed, deferred)
  execution-plans/
    active/            ← in-flight ExecPlans (living documents)
    completed/         ← finished ExecPlans for posterity
    tech-debt-tracker.md
  product-specs/
    index.md           ← spec catalogue
    <feature>.md       ← individual product specs
  ...
```

When Claude Code opens a session it reads root `CLAUDE.md` (the map — kept short to preserve context). When it navigates into `src/auth/`, it **automatically lazy-loads** `src/auth/CLAUDE.md` — this is native Claude Code behavior, no configuration needed. Because module docs are only loaded when relevant, they can and **should** be thorough: patterns with canonical file references, key types with definition locations, gotchas, testing approach, and everything else a contributor needs to work in that module without reading source files first.

---

## Installation

Install as a Claude Code plugin, then run in any repository:

```
/garden:init
```

This scaffolds the full documentation structure, installs git hooks, generates module-level `CLAUDE.md` files based on your existing source code, and creates the plan tracking directories. If your repo already has plans or specs in non-standard locations (e.g., a `plans/` directory from another plugin), init will offer to migrate them.

---

## Commands

| Command | Description |
|---|---|
| `/garden:init` | Scaffold docs structure, install hooks, detect and migrate stray plans/specs |
| `/garden:tend` | Update docs that have drifted from the code; flag newly created stray plan/spec files |
| `/garden:weed` | Find and prune stale or irrelevant docs, including misplaced plans and specs (interactive) |
| `/garden:status` | Knowledge base health dashboard |
| `/garden:scaffold-module <path>` | Generate `CLAUDE.md` stub for a module |
| `/garden:harmonize` | Find plans/specs in non-standard locations and migrate them into `docs/execution-plans/` and `docs/product-specs/` |

---

## Plan Tracking

Plans are treated as first-class artifacts. `docs/PLANS.md` is the master catalogue. Complex work lives in **ExecPlans** — living documents under `docs/execution-plans/active/` that track progress, decisions, and outcomes as work proceeds.

**ExecPlan structure** (enforced by linter):
- `## Progress` — checkbox list updated at every stopping point
- `## Decision Log` — records every key decision and its rationale
- `## Outcomes & Retrospective` — summary written at completion

When a plan is done, move it to `docs/execution-plans/completed/`. Known technical debt lives in `docs/execution-plans/tech-debt-tracker.md`.

**`/garden:harmonize`** handles repos that already have plans elsewhere. It scans `plans/`, `specs/`, `features/`, `.agent/plans/`, and any `.md` file with plan/spec content signals, then offers an interactive migration into the standard structure. This runs automatically during `/garden:init` and is also surfaced by `/garden:tend` when new stray files appear.

---

## Enforcement

Five linter scripts run as git hooks. All are pure Node.js with no npm dependencies.

**Pre-commit** (runs on every `git commit` — fast, staged-files only):

| Check | What it catches |
|---|---|
| `claude-md` | `CLAUDE.md` over line limit; broken links in `CLAUDE.md` |
| `module-claude-md` | Module directories with >10 files missing a `CLAUDE.md` |
| `doc-coverage` | Source files staged without any doc changes |
| `freshness-marker` | Docs whose `<!-- last-reviewed -->` date is stale |
| `plans-misplaced` | Staged `.md` files in `plans/`, `specs/`, `features/`, or matching `*-plan.md` — warns the moment you try to commit a plan in the wrong place |

**Pre-push / CI** (runs before `git push` and in CI — thorough, full-tree):

| Check | What it catches |
|---|---|
| `cross-links` | Broken links anywhere in `docs/` |
| `claude-md-toc-sync` | Docs not reachable from `CLAUDE.md` |
| `plans-stray` | Any `.md` file outside `docs/` with plan/spec content signals (full-repo scan) |
| `plans-catalogue-exists` | `docs/PLANS.md` absent |
| `plans-orphan` | Files under `docs/execution-plans/` not linked from `docs/PLANS.md` |
| `plans-active-structure` | Active plans missing `## Progress`, `## Decision Log`, or `## Outcomes & Retrospective` |

**GitHub Actions** (optional, copy from `github-actions/garden-ci.yml`):
- Runs the full pre-push lint suite on every PR

Warnings are non-blocking. Errors (`plans-active-structure`, broken links, line limit exceeded) block the commit or push.

---

## Interactive Remediation in Claude Code

When Claude Code runs a `git commit` or `git push` that gets blocked by garden linter errors, instead of printing slash commands you have to manually re-type, it surfaces an interactive prompt asking what to do.

**In a Claude Code session** (Claude is doing the commit):

> _Garden linter found 2 error(s). What would you like to do?_
> - Run `/garden:harmonize` (move misplaced plan/spec files into docs/)
> - Run all applicable fixes
> - Skip for now (commit stays blocked)
> - **Auto-accept fixes on future commits/PRs — run now + save preference**

Selecting a fix causes Claude to run the skill and then offer to re-commit. Selecting **Auto-accept** saves your preference so future commits silently run fixes without asking.

**Auto-accept preference** is stored in `.garden/config.local.json` (gitignored — personal, never committed). To disable it:

```bash
# View current preference
cat .garden/config.local.json

# Reset auto-accept
rm .garden/config.local.json
# or manually set: {"auto_accept_fixes": false}
```

**In a terminal session** (you ran `git commit` yourself):

Instead of `/garden:harmonize`, the output shows a copy-pasteable command:

```
To fix, open a Claude session or run in your terminal:
  claude -p "/garden:harmonize"   — move misplaced plan/spec files into docs/
```

---

## The Gardener Agent

`/garden:tend` is a Claude Code skill — Claude itself is the agent. No external API calls, no SDK. When you run it, Claude:

1. Gets a git diff since the last gardening run
2. Maps changed source files to candidate docs
3. Reads each candidate and reasons about what's stale
4. Makes minimal, targeted updates
5. Checks for newly created stray plan/spec files and offers to migrate them
6. Regenerates auto-generated docs (e.g., `docs/generated/db-schema.md`)
7. Stages the changes and logs the run

Run it weekly or after significant changes. Use `--dry-run` to preview.

---

## Configuration

`.garden/config.json` (created by `/garden:init`):

```json
{
  "version": "1",
  "claude_md_max_lines": 250,
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

All settings have sensible defaults. No configuration required to get started. The `plans` block is optional — omit it to use the defaults.

---

## Freshness Markers

Docs opt into freshness tracking:

```markdown
<!-- last-reviewed: 2026-03-07 -->
```

Mark sections the gardener shouldn't touch:

```markdown
<!-- garden-managed: manual -->
Human-maintained content here.
<!-- garden-managed: auto -->
```

---

## Dependencies

**Zero runtime dependencies for AI features** — Claude Code is the AI layer.

**Linter scripts** use only Node.js built-ins (`fs`, `path`, `child_process`). No `npm install` required.

**Optional:**
- `node` ≥18 — for git hooks
- `gh` CLI — for `/garden:tend --pr`
