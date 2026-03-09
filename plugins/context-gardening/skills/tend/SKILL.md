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

Run the lint suite in JSON mode so the output can be parsed programmatically:

```bash
LINTERS_DIR="$(git rev-parse --show-toplevel)/.garden/linters"
if [ -f "$LINTERS_DIR/run-all.js" ]; then
  node "$LINTERS_DIR/run-all.js" --pre-push --json
fi
```

If the linters are not installed (`.garden/linters/run-all.js` absent), skip this step silently.

Parse the JSON array. For each result where `status` is `"warn"` or `"error"`, translate it into a concrete remediation task and add it to the work queue, merging with the diff-derived candidate list from Step 2. Deduplicate.

Use this mapping to decide what to do for each failing check:

| Check | Remediation |
|---|---|
| `claude-md-toc-sync` | Add links in CLAUDE.md for every doc listed in the `detail` field (the warning includes the exact file paths) |
| `claude-md-length` | Trim CLAUDE.md — tighten prose, remove redundant sections — to bring it under the limit |
| `claude-md-links` | Fix each broken link identified in `detail` |
| `module-claude-md-length` | Trim the specific module CLAUDE.md named in `message` |
| `freshness-marker` | Update `<!-- last-reviewed: YYYY-MM-DD -->` in each stale doc listed in `detail` |
| `cross-links` | Fix each broken cross-link pair listed in `detail` |
| `plans-orphan` | Add missing plan entries to `docs/PLANS.md` |
| `plans-active-structure` | Add the missing required sections to each active plan named in `detail` |
| `doc-coverage` | Ensure the identified source file's corresponding doc is in the candidate list |

When processing a lint-derived candidate in Step 3, include the lint finding as explicit context:
> "Lint reported `<check>`: <message>. <detail>"

This ensures the agent has both the diff context (what changed in code) and the structural context (what rule is violated) when deciding how to update docs.

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

**Step 3b — Check for newly created stray plan and spec files**

After updating candidate docs, check whether any new plan or spec files have been created in non-standard locations since the last tend run. This catches files written by other plugins (e.g., `plans/` from the compound-engineering workflows plugin) or by hand.

```bash
# Files added since last SHA in known non-standard locations
git log <last_sha>..HEAD --diff-filter=A --name-only --oneline \
  -- 'plans/*.md' '.agent/plans/*.md' 'specs/*.md' 'features/*.md' '.agent/specs/*.md' \
  2>/dev/null || true

# If last_sha is null, check files added in the last 30 days
git log --since="30 days ago" --diff-filter=A --name-only --oneline \
  -- 'plans/*.md' 'specs/*.md' 'features/*.md' \
  2>/dev/null || true
```

Filter out any file whose content contains "has moved to" (already a forwarding stub). Filter out files already under `docs/`.

If new stray files are found, report them inline:

"I also noticed new plan/spec files outside the standard structure:
  - plans/feat-auth.md (added <date>)
  - specs/dark-mode.md (added <date>)

These should live in `docs/execution-plans/` and `docs/product-specs/`. Run `/garden:harmonize` to migrate them, or I can do it now."

Use the **AskUserQuestion tool** with two options: "Migrate now" or "Skip (I'll run /garden:harmonize later)". If the user chooses migrate, apply the migration logic from `/garden:harmonize` Steps 4–7 for each file. If skip, note the files in the gardening log.

If no new stray files are found, continue silently.

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

Tell the user what was updated, what was skipped, and why. Include a short lint section:
- List any lint warnings/errors that were resolved by this run
- List any that remain unresolved (e.g. require manual intervention or a different skill like `/garden:weed`)

Suggest running `/context-gardening:status` to see overall health.
