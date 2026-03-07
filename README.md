# context-gardening

A Claude Code plugin for agent-legible repository knowledge management.

Enforces the principle that `CLAUDE.md` should be a **navigation map** (~100 lines), not an encyclopedia. Knowledge lives in a structured `docs/` directory with per-module `CLAUDE.md` files for local conventions — natively lazy-loaded by Claude Code when it navigates into each directory.

---

## The Pattern

```
CLAUDE.md              ← map/TOC only. ~100 lines. Read by Claude at session start.
ARCHITECTURE.md        ← domain map and package layering
src/
  auth/CLAUDE.md       ← auth module: style guide, patterns, rules
  api/CLAUDE.md        ← api module: REST conventions, error formats
docs/
  DESIGN.md            ← design philosophy
  SECURITY.md          ← security posture
  RELIABILITY.md       ← SLOs and runbooks
  ...
```

When Claude Code opens a session it reads `CLAUDE.md` (the map). When it navigates into `src/auth/`, it **automatically lazy-loads** `src/auth/CLAUDE.md` (the local rules) — this is native Claude Code behavior, no configuration needed. **Progressive disclosure** — agents get what they need, when they need it.

---

## Installation

Install as a Claude Code plugin, then run in any repository:

```
/garden:init
```

This scaffolds the full documentation structure, installs git hooks, and generates module-level `CLAUDE.md` files based on your existing source code.

---

## Commands

| Command | Description |
|---|---|
| `/garden:init` | Scaffold docs structure in current repo |
| `/garden:tend` | Update docs that have drifted from the code |
| `/garden:weed` | Find and prune stale or irrelevant docs (interactive) |
| `/garden:status` | Knowledge base health dashboard |
| `/garden:scaffold-module <path>` | Generate `CLAUDE.md` stub for a module |

---

## Enforcement

**Pre-commit hooks** (fast, local — installed by `/garden:init`):
- `CLAUDE.md` line count ≤ limit (default 150)
- All links in `CLAUDE.md` resolve to real files
- Module directories with >10 files should have `CLAUDE.md`
- Source file changes without doc changes → warning

**Pre-push hooks** (stricter):
- Cross-link validation across all docs
- Orphaned docs not reachable from `CLAUDE.md`

**GitHub Actions** (optional, copy from `github-actions/garden-ci.yml`):
- Runs full CI lint on every PR

All hooks are warnings by default. Only structural errors (broken links, line limit exceeded) block commits.

---

## The Gardener Agent

`/garden:tend` is a Claude Code skill — Claude itself is the agent. No external API calls, no SDK. When you run it, Claude:

1. Gets a git diff since the last gardening run
2. Maps changed source files to candidate docs
3. Reads each candidate and reasons about what's stale
4. Makes minimal, targeted updates
5. Regenerates auto-generated docs (e.g., `docs/generated/db-schema.md`)
6. Stages the changes and logs the run

Run it weekly or after significant changes. Use `--dry-run` to preview.

---

## Configuration

`.garden/config.json` (created by `/garden:init`):

```json
{
  "version": "1",
  "claude_md_max_lines": 150,
  "module_md_max_lines": 150,
  "module_md_required_above_file_count": 10,
  "freshness_warn_days": 30,
  "freshness_error_days": 90,
  "doc_coverage_mode": "warn",
  "source_dirs": ["src", "app", "lib"],
  "generated_docs": ["docs/generated/db-schema.md"],
  "ignore_paths": ["node_modules", ".git", "dist", "build"],
  "source_doc_mappings": []
}
```

All settings have sensible defaults. No configuration required to get started.

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
