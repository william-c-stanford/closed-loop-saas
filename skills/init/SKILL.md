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

**Step 5 — Scaffold per-module CLAUDE.md files**

For every qualifying module you identified in Step 3 (all source_dirs × their subdirectories with ≥10 files):
1. Read 3-5 source files from that module to understand its purpose (prefer index/entry files, files with descriptive names; skip tests and generated files)
2. Fill in `templates/module-CLAUDE.md.md` template with specific, concrete content
3. Write to `<module-dir>/CLAUDE.md`

Skip modules that already have a CLAUDE.md.

Do NOT leave this step partially done. If there are 8 qualifying modules, scaffold all 8. The goal is that `/context-gardening:status` shows zero missing CLAUDE.md warnings immediately after init completes.

**Step 6 — Install linters**

Copy linter scripts to .garden/linters/:
```bash
mkdir -p .garden/linters
```

Locate the plugin directory (the directory containing this SKILL.md's parent `skills/init/` folder) and copy all files from `linters/` into `.garden/linters/`.

Install git hooks:
```bash
# Copy from plugin's git-hooks/ directory
cp <plugin-path>/git-hooks/pre-commit .git/hooks/pre-commit
cp <plugin-path>/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

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
