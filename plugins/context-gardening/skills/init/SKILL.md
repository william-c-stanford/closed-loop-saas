---
description: Scaffold an agent-legible documentation structure in the current repository. Creates CLAUDE.md (navigation map), ARCHITECTURE.md, docs/ directory with all standard docs, and per-module CLAUDE.md files for local conventions. Installs git hooks for doc linting. Use when setting up context-gardening in a new repo.
---

You are initializing context-gardening in the current repository. Follow these steps precisely.

**Step 1 — Inspect the repo**

Run these commands to understand what you're working with:

```bash
ls -la
cat package.json 2>/dev/null || cat pyproject.toml 2>/dev/null || cat Gemfile 2>/dev/null || cat go.mod 2>/dev/null || echo "No manifest found"
ls -d */ 2>/dev/null
ls docs/ 2>/dev/null || echo "No docs/ directory yet"
cat CLAUDE.md 2>/dev/null || cat README.md 2>/dev/null | head -40 || echo "No existing context file"
```

**Step 2 — Check for existing files to avoid overwriting**

```bash
ls CLAUDE.md ARCHITECTURE.md docs/ .garden/ 2>/dev/null
```

Never overwrite files that already exist unless the user explicitly asked with `--force`.

**Step 3 — Detect source modules comprehensively**

Run a broad search to find all directories that contain source code, including nested structures like `frontend/src/`, `backend/src/`, `agent/internal/`, etc.:

```bash
# Find all src/app/lib/internal directories at any depth (max 3 levels deep)
find . -maxdepth 3 -type d \( -name "src" -o -name "app" -o -name "lib" -o -name "internal" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" \
  2>/dev/null

# Also list top-level directories to understand the repo structure
ls -d */ 2>/dev/null
```

From this output, identify:
- **`source_dirs`**: all directories that directly contain modules/packages (e.g., `frontend/src`, `agent/internal`, `src`). These are the dirs whose *immediate subdirectories* are modules.
- **Qualifying modules**: for each source_dir, list its immediate subdirectories. A module qualifies for a CLAUDE.md if it has ≥10 source files inside it (use `find <dir> -not -name "*.md" | wc -l` to count).

List all qualifying modules before proceeding.

**Step 4 — Scaffold the docs structure**

Read the templates from the plugin's `templates/` directory. Fill in the placeholders based on what you found:
- `{{REPO_NAME}}` — from package.json `name`, directory name, or ask
- `{{DATE}}` — today's date in YYYY-MM-DD format
- `{{REPO_DESCRIPTION}}` — from package.json description or README first paragraph
- `{{DOMAIN_LIST}}` — source_dirs you found (comma-separated)
- `{{MODULE_TABLE_ROWS}}` — one `| module/ | [module/CLAUDE.md](./module/CLAUDE.md) |` row per qualifying module
- `{{STACK_DESCRIPTION}}` — detected tech stack
- `{{DIR_LAYOUT}}` — actual directory layout from ls

Create these files and directories if they don't exist:
- `CLAUDE.md` — use templates/CLAUDE.md.md, filled with repo-specific content
- `ARCHITECTURE.md` — use templates/ARCHITECTURE.md.md
- `docs/DESIGN.md`, `docs/SECURITY.md`, `docs/FRONTEND.md`, `docs/RELIABILITY.md`, `docs/QUALITY_SCORE.md`, `docs/PRODUCT_SENSE.md`
- `docs/design-docs/index.md`, `docs/design-docs/core-beliefs.md`
- `docs/product-specs/index.md`
- `docs/references/.gitkeep`, `docs/generated/.gitkeep`

Add `<!-- garden-managed: auto -->` as the second line of every generated file.

**Step 4b — Scaffold execution plans infrastructure**

Create the plan lifecycle directories and initial catalogue:

```bash
mkdir -p docs/execution-plans/active
mkdir -p docs/execution-plans/completed
```

Read `templates/docs/execution-plans/tech-debt-tracker.md.md` from the plugin and write it to `docs/execution-plans/tech-debt-tracker.md`, replacing `{{DATE}}` with today's date in YYYY-MM-DD format.

Read `templates/docs/PLANS.md.md` from the plugin and write it to `docs/PLANS.md`, replacing:
- `{{DATE}}` with today's date in YYYY-MM-DD format
- `{{PLANS_ACTIVE_ROWS}}` with `_No plans yet._`
- `{{PLANS_COMPLETED_ROWS}}` with `_No plans yet._`

Skip this step (do not overwrite) if `docs/PLANS.md` already exists.

**Step 4c — Detect and offer to harmonize stray plans and specs**

After scaffolding the plans infrastructure, scan the repo for plan and spec files that are already present but in non-standard locations. These are files created by other plugins (such as the compound-engineering workflows plugin, which writes to `plans/`) or by hand, that should live under `docs/execution-plans/` and `docs/product-specs/`.

Run these searches:

```bash
# Location-based plan candidates
find plans/ .agent/plans/ -name "*.md" 2>/dev/null | grep -v "README.md" || true

# Content-based plan candidates (outside docs/)
grep -rl "## Progress\|## Milestones\|## Decision Log\|## Implementation Plan" \
  --include="*.md" \
  --exclude-dir=docs --exclude-dir=node_modules --exclude-dir=".git" \
  . 2>/dev/null || true

# Location-based spec candidates
find specs/ features/ .agent/specs/ -name "*.md" 2>/dev/null | grep -v "README.md" || true
```

Exclude any file whose content contains "has moved to" (forwarding stub) and any file already under `docs/`.

If candidates are found, use the **AskUserQuestion tool** to present them as a multi-select. Label each option: `<current-path> → <destination>  [plan/spec, active/completed]`. Tell the user these files were found outside the standard structure and ask which ones to migrate now. Unselected files will be left in place and can be migrated later with `/garden:harmonize`.

For each confirmed file, apply the migration logic from `/garden:harmonize` Steps 6–7: append any missing required sections to plans, write the file to the destination, write a forwarding stub at the original path, and update `docs/PLANS.md` or `docs/product-specs/index.md` accordingly.

If no candidates are found, skip silently and continue to Step 5.

**Step 5 — Scaffold per-module CLAUDE.md files**

For every qualifying module you identified in Step 3 (all source_dirs × their subdirectories with ≥10 files):
1. Read 10-20 source files from that module — prioritise entry points, files with many imports, and files whose names suggest core patterns (service, repository, handler, controller). Also read test files to understand the testing approach.
2. Infer: purpose, internal architecture, coding conventions, key patterns with canonical file references, key types/interfaces, what belongs/doesn't belong, key dependencies, testing approach, and any non-obvious gotchas.
3. Fill in `templates/module-CLAUDE.md.md` with concrete, specific content for every section. Do not write generic statements. The module CLAUDE.md is only loaded when Claude navigates into this directory — it should be thorough enough that a contributor never needs to re-read the source to understand conventions.
4. Write to `<module-dir>/CLAUDE.md`

Skip modules that already have a CLAUDE.md.

Do NOT leave this step partially done. If there are 8 qualifying modules, scaffold all 8. The goal is that `/context-gardening:status` shows zero missing CLAUDE.md warnings immediately after init completes.

**Step 6 — Install linters and hooks**

Copy linter scripts to .garden/linters/:
```bash
mkdir -p .garden/linters .garden/hooks
```

Locate the plugin directory (the directory containing this SKILL.md's parent `skills/init/` folder) and copy all files from `linters/` into `.garden/linters/`, and all files from `hooks/` into `.garden/hooks/`.

Install git hooks:
```bash
# Copy from plugin's git-hooks/ directory
cp <plugin-path>/git-hooks/pre-commit .git/hooks/pre-commit
cp <plugin-path>/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

Add `.garden/config.local.json` to `.gitignore` (this file stores personal Claude Code preferences and must not be committed):
```bash
echo '.garden/config.local.json' >> .gitignore
```

If `.gitignore` doesn't exist yet, create it with that single entry.

**Step 7 — Create .garden/config.json**

Use the source_dirs you actually found in Step 3 (not the defaults):

```json
{
  "version": "1",
  "claude_md_max_lines": 150,
  "module_md_max_lines": 150,
  "module_md_required_above_file_count": 10,
  "freshness_warn_days": 30,
  "freshness_error_days": 90,
  "doc_coverage_mode": "warn",
  "source_dirs": ["<actual source dirs detected in Step 3>"],
  "generated_docs": ["docs/generated/db-schema.md"],
  "ignore_paths": ["node_modules", ".git", "dist", "build"]
}
```

Create `.garden/last-tended.json`:
```json
{"last_sha": null, "last_run": null, "tended_count": 0}
```

**Step 8 — Ask about GitHub Actions**

Ask: "Would you like me to add a GitHub Actions workflow for CI linting? (`.github/workflows/garden-ci.yml`)"

If yes, copy `github-actions/garden-ci.yml` from the plugin to `.github/workflows/garden-ci.yml`.

Additionally, check whether this is a Python project by looking for `pyproject.toml`, `setup.py`, `setup.cfg`, or `requirements.txt` in the repo root. If any of these exist, also ask: "I also detected a Python project. Would you like me to add a Python CI workflow with formatting, linting, type checking, and tests? (`.github/workflows/python-ci.yml`)"

If yes, copy `github-actions/python-ci.yml` from the plugin to `.github/workflows/python-ci.yml`. Note that the workflow installs `ruff` and `mypy` automatically — no manual setup is needed. Remind the user they can customise the Python version or test paths in the file if needed.

**Step 9 — Verify and report**

Run the linter to confirm init was comprehensive:
```bash
node .garden/linters/run-all.js --status --json
```

If there are any `module-claude-md-required` warnings, scaffold the missing CLAUDE.md files now before finishing. Init is not complete until this check shows no missing module CLAUDE.md warnings.

List all files created and skipped. Tell the user:
- How to run `/context-gardening:status` to check knowledge base health
- How to run `/context-gardening:tend` to keep docs synced with code
- That CLAUDE.md is the entry point agents will read at session start
