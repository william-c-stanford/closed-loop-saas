---
description: Run the doc-gardener agent. Diffs code changes since the last gardening run, identifies stale documentation, and makes minimal targeted updates. Also regenerates auto-generated docs (db-schema.md etc). Use when docs may have drifted from the code, or on a regular schedule. Accepts optional flags in $ARGUMENTS: --dry-run, --pr, --since <date>.
---

You are running the documentation gardener. Arguments provided: "$ARGUMENTS"

Parse $ARGUMENTS for flags:
- `--dry-run` → describe what would change but don't write anything
- `--pr` → after updating, create a PR via `gh pr create`
- `--since <date>` → use this date instead of the stored last SHA

**Step 1 — Get the diff since last run**

```bash
cat .garden/last-tended.json 2>/dev/null || echo '{"last_sha": null}'
git rev-parse HEAD
```

If `last_sha` is null or `--since` was provided, get changes from the past 30 days (or since the given date):
```bash
git log --since="30 days ago" --name-only --oneline
# or: git log --since="<date>" --name-only --oneline
```

Otherwise:
```bash
git log <last_sha>..HEAD --name-only --oneline
```

If there are no changes, tell the user and stop.

**Step 2 — Map changed files to candidate docs**

For each changed source file, determine which docs might be affected using these heuristics:
- `src/<module>/` changed → `src/<module>/CLAUDE.md` is a candidate
- `*auth*, *oauth*, *jwt*, *session*` → `docs/SECURITY.md`
- `*api*, *route*, *endpoint*, *controller*` → `docs/DESIGN.md`
- `*component*, *ui*, *view*, *page*` → `docs/FRONTEND.md`
- `*migration*, *schema*` → `docs/generated/db-schema.md`
- `*test*, *spec*` → `docs/RELIABILITY.md`
- `*deploy*, *infra*` → `docs/RELIABILITY.md`
- `package.json, pyproject.toml, go.mod` → `ARCHITECTURE.md`

Also check `.garden/config.json` for custom `source_doc_mappings`.

Deduplicate the candidate list. Only include docs that actually exist.

**Step 2b — Run lint to surface structural doc issues**

Run both lint modes in JSON mode so the output can be parsed programmatically. Run them both — pre-commit catches fast staged-file violations, pre-push catches full-tree structural issues:

```bash
LINTERS_DIR="$(git rev-parse --show-toplevel)/.garden/linters"
if [ -f "$LINTERS_DIR/run-all.js" ]; then
  node "$LINTERS_DIR/run-all.js" --pre-commit --json
  node "$LINTERS_DIR/run-all.js" --pre-push --json
fi
```

If the linters are not installed (`.garden/linters/run-all.js` absent), skip this step silently.

Merge the two JSON arrays into a single result set. Deduplicate by `check` + `message` (pre-push runs a superset of pre-commit checks, so some findings may appear in both). For each result where `status` is `"warn"` or `"error"`, translate it into a concrete remediation task and add it to the work queue, merging with the diff-derived candidate list from Step 2. Deduplicate.

Use this mapping to decide what to do for each failing check:

**Pre-commit checks** (staged-file scope):

| Check | Remediation |
|---|---|
| `claude-md-length` | Trim CLAUDE.md — tighten prose, remove redundant sections — to bring it under the line limit |
| `claude-md-links` | Fix each broken link identified in `detail` |
| `module-claude-md-length` | Trim the specific module CLAUDE.md named in `message` |
| `module-claude-md-required` | Generate a `CLAUDE.md` for each module directory listed in `detail` using `/context-gardening:scaffold-module` logic |
| `doc-coverage` | Ensure the source file identified in `detail` has a corresponding doc candidate in the work queue |
| `freshness-marker` | Update `<!-- last-reviewed: YYYY-MM-DD -->` in each stale doc listed in `detail` |
| `plans-misplaced` | Note the flagged file — surface it as a stray plan (same as Step 3b logic) and offer to migrate via `/garden:harmonize` |

**Pre-push checks** (full-tree scope, superset of above):

| Check | Remediation |
|---|---|
| `claude-md-toc-sync` | Add links in CLAUDE.md for every doc listed in the `detail` field |
| `cross-links` | Fix each broken relative link pair listed in `detail` |
| `plans-stray` | Surface the flagged file as a stray plan and offer to migrate |
| `plans-catalogue-exists` | Create `docs/PLANS.md` from the plans catalogue template |
| `plans-orphan` | Add missing plan entries to `docs/PLANS.md` |
| `plans-active-structure` | Add the missing required sections (`## Progress`, `## Decision Log`, `## Outcomes & Retrospective`) to each active plan named in `detail` |

**For each lint finding (pre-commit or pre-push), enrich it with git context** — extract the files mentioned in `detail` (file paths, module names, etc.) and run:

```bash
# Which commits touched those files since the last garden run?
git log <last_sha>..HEAD --oneline -- <file1> <file2> ...

# What exactly changed in those files?
git diff <last_sha>..HEAD -- <file1> <file2> ...
```

If `last_sha` is null, scope to the past 30 days (`--since="30 days ago"`).

Attach the results to the lint finding as a `git_context` block:
```
lint finding: claude-md-toc-sync
  flagged files : docs/gardening-log.md, docs/generated/db-schema.md
  related commits:
    a1b2c3d  docs: add gardening log (Jane, 2 days ago)
    e4f5g6h  feat: regenerate db schema (Bob, 5 days ago)
  diff summary  : docs/gardening-log.md created (new file), docs/generated/db-schema.md regenerated
```

When processing a lint-derived candidate in Step 3, pass the full enriched context block:
> "Lint reported `<check>`: <message>. <detail>
> Related commits: <commits>
> Diff: <diff summary>"

This gives the agent both the structural violation (what rule failed) and the causal history (what code changes triggered it), so it can make precise, well-reasoned edits rather than guessing.

**Step 3 — For each candidate doc**

Read the doc. Read the changed source files (or the relevant diff). Then reason:
- Has the code changed in a way that makes this doc factually incorrect?
- Are there new patterns or APIs not mentioned in the doc?
- Are there removed features still described in the doc?

If the doc needs updating:
- Make the **minimum necessary change** — don't rewrite or restructure
- Preserve existing voice, tone, and formatting
- Skip any section marked `<!-- garden-managed: manual -->`
- Update the `<!-- last-reviewed: -->` marker to today's date

If `--dry-run`: describe what you would change for each doc, but don't write.

Otherwise: write the update using Edit (never Write, to preserve existing content).

**Step 3b — Discover and migrate stray plan and spec files**

Scan for plan and spec files outside the standard structure. This runs the full harmonize logic inline — no separate command required.

**Discovery — location-based:**
```bash
# Plans in non-standard locations (including docs/plans/ — a common intermediate location)
find plans/ .agent/plans/ docs/plans/ todos/ -name "*.md" 2>/dev/null
ls *-plan.md *.plan.md PLANS.md 2>/dev/null | grep -v "^ls:" || true

# Specs in non-standard locations
find specs/ features/ .agent/specs/ -name "*.md" 2>/dev/null
```

**Discovery — content-based:**

Scan all `.md` files outside `node_modules/` and `.git/`, but exclude the standard destinations (`docs/execution-plans/`, `docs/product-specs/`) so already-migrated files are not re-processed. Note: `docs/plans/` is intentionally **not** excluded — files there are candidates for migration.

```bash
# Plan signals: 2+ of these headings in the same file
grep -rl "## Progress\|## Milestones\|## Decision Log\|## Implementation Plan\|## Acceptance Criteria" \
  --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=".git" \
  --exclude-dir=execution-plans --exclude-dir=product-specs \
  . 2>/dev/null

# Spec signals: 2+ of these headings (and doesn't already qualify as a plan)
grep -rl "## User Story\|## Problem Statement\|## Proposed Solution" \
  --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=".git" \
  --exclude-dir=execution-plans --exclude-dir=product-specs \
  . 2>/dev/null
```

Also incorporate any `plans-misplaced` or `plans-stray` lint findings from Step 2b — those files are already identified candidates.

Exclude: files whose content contains "has moved to" (forwarding stubs), `README.md`, files already under `docs/`.

If no stray files are found, continue silently.

**Classification — for each stray plan:**

Determine lifecycle stage:
- **Completed**: `## Outcomes & Retrospective` has substantive content AND `## Progress` has no unchecked `- [ ]` boxes
- **Active**: everything else

Determine destination: `docs/execution-plans/active/<filename>` or `docs/execution-plans/completed/<filename>`

Identify missing required sections (any of `## Progress`, `## Decision Log`, `## Outcomes & Retrospective` not present).

**Migration — plans:**

If `--dry-run`: describe each migration (source → destination, stage, missing sections) but don't write anything.

Otherwise, for each stray plan:

1. Read the file content.
2. Append any missing required sections using these exact placeholders:

   ```markdown
   ## Progress

   _No progress entries yet. Add checkboxes as work begins._

   ## Decision Log

   _No decisions recorded yet._

   ## Outcomes & Retrospective

   _Populated at completion._
   ```

   Only append sections that are genuinely absent. Do not duplicate existing sections.

3. Write the updated content to the destination path. Create the directory if needed:
   ```bash
   mkdir -p docs/execution-plans/active
   mkdir -p docs/execution-plans/completed
   ```

4. Overwrite the original file with a forwarding stub:
   ```markdown
   # [Moved] <original filename without extension>

   This plan has moved to [`<destination>`](<destination>).

   It was migrated by `/garden:tend` on <YYYY-MM-DD>.
   ```

5. Update `docs/PLANS.md`: insert a new row in the Active or Completed table. Infer a one-line summary from the plan's Purpose/Overview or first paragraph. Row format:
   ```
   | [<title>](execution-plans/<stage>/<filename>.md) | <Active or Completed> | <YYYY-MM> | <summary> |
   ```
   Use Edit to insert after the table header. If the section contains only `_No plans yet._`, replace that line with the new row.

**Migration — specs:**

If `--dry-run`: describe each migration but don't write.

Otherwise, for each stray spec:

1. Read the file content.
2. Write it to `docs/product-specs/<filename>.md`.
3. Overwrite the original with a forwarding stub:
   ```markdown
   # [Moved] <original filename without extension>

   This spec has moved to [`docs/product-specs/<filename>`](docs/product-specs/<filename>.md).

   It was migrated by `/garden:tend` on <YYYY-MM-DD>.
   ```
4. Update `docs/product-specs/index.md`: insert a new row in the Active Specs table. Row format:
   ```
   | [<title>](<filename>.md) | Draft | <one-line description> |
   ```
   If the table contains only `*(none yet)*`, replace that line with the new row.

**Step 3c — Check for undiscoverable MDX files**

Detect whether the repo contains an MDX-based docs site:

```bash
# Nextra (_meta.json files govern sidebar)
find . -name "_meta.json" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -5

# Docusaurus
ls docs/sidebars.js docs/sidebars.ts sidebars.js sidebars.ts 2>/dev/null
ls docusaurus.config.js docusaurus.config.ts 2>/dev/null

# Generic MDX inventory
find . -name "*.mdx" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.next/*" 2>/dev/null
```

If no `.mdx` files exist anywhere in the repo, skip this step silently.

**Nextra repos** (identified by presence of `_meta.json` files):
- Build the set of all `.mdx` files under the docs root (typically `pages/` or `app/` or `docs/`).
- Build the set of all `.mdx` files referenced (directly or as directory keys) across all `_meta.json` files. A file is referenced if its stem (filename without extension) appears as a key in any `_meta.json` in its parent directory.
- Orphans = mdx files whose stem does NOT appear as a key in the `_meta.json` of their parent directory.

**Docusaurus repos** (identified by `sidebars.js` / `sidebars.ts` / `docusaurus.config.js`):
- Read the sidebar config file to extract all referenced doc IDs (e.g., `'intro'`, `'guides/quickstart'`).
- Build the set of all `.mdx` files under `docs/` (or the configured docs root). A file is referenced if its path relative to the docs root (without extension) matches a sidebar doc ID.
- Orphans = mdx files with no matching doc ID in any sidebar.

**Other / unknown nav structure:**
- Check `.garden/config.json` for a `mdx_nav_config` field pointing to the nav file.
- If not configured, report that MDX files were found but nav format is unknown, and ask the user to set `mdx_nav_config` in `.garden/config.json`.

If orphaned MDX files are found, report them:

"I also found MDX files not reachable via the navigation structure:
  - pages/deep-dive/advanced.mdx (not in _meta.json)
  - pages/changelog/v2.mdx (not in _meta.json)

These pages exist but users can't navigate to them. Add them to the appropriate `_meta.json` (or `sidebars.js`) to make them discoverable."

List each orphan with its path and which nav file it's missing from. Do NOT auto-modify nav config files — navigation order is intentional. Only report.

If no orphans are found, continue silently.

**Step 4 — Handle generated docs**

For `docs/generated/db-schema.md`, regenerate from source:
- **Django**: read files in `*/migrations/` and extract model fields, then write a schema summary
- **Rails**: read `db/schema.rb`
- **Prisma**: read `prisma/schema.prisma`
- **Drizzle/TypeORM**: read entity/schema definition files
- **SQLAlchemy**: read model files with Column definitions

If you can't detect the ORM, note this in the log and skip.

**Step 5 — Stage the changes**

```bash
git add docs/ ARCHITECTURE.md CLAUDE.md
git add $(find . -name "CLAUDE.md" -not -path "./.git/*" -not -path "./node_modules/*" | head -20)
```

**Step 6 — If --pr flag**

```bash
git checkout -b garden/tend-$(date +%Y-%m-%d)
git commit -m "docs: garden tend $(date +%Y-%m-%d)

Automated doc update from /context-gardening:tend"
gh pr create --title "docs: garden tend $(date +%Y-%m-%d)" --body "Automated documentation update.

## Updated docs
<list each updated file and the reason>

Generated by context-gardening"
```

**Step 7 — Update state and log**

Append to `docs/gardening-log.md` (create if it doesn't exist):
```markdown
## YYYY-MM-DD — Garden Run

- **Updated:** <file> — <one-line reason>
- **Skipped:** <file> — no relevant changes
- **Generated:** <file>
- **Lint fix:** <check> — <what was fixed> (e.g. "claude-md-toc-sync — added links for docs/gardening-log.md, docs/generated/db-schema.md")
- **Migrated plan:** <original-path> → <destination> [<stage>, added sections: <list or "none">]
- **Migrated spec:** <original-path> → docs/product-specs/<filename>
```

Update `.garden/last-tended.json`:
```json
{
  "last_sha": "<current HEAD sha from git rev-parse HEAD>",
  "last_run": "<ISO timestamp>",
  "tended_count": <previous count + number updated>
}
```

**Step 8 — Summary**

Tell the user what was updated, what was skipped, and why. Group the output into sections:
- **Doc updates:** files updated from diff-derived or lint-derived candidates
- **Lint fixes:** warnings/errors resolved this run, and any that remain unresolved (e.g. those requiring `/garden:weed`)
- **Migrations:** plans and specs moved into the standard structure, with their destinations and any sections that were added

Suggest running `/context-gardening:status` to see overall health.
