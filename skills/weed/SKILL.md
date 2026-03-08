---
description: Find and interactively prune documentation that is no longer relevant — orphaned docs, AI-generated stubs never filled in, docs referencing deleted code, and superseded content. Presents an interactive multi-select for the user to confirm deletions. Use when the docs/ directory has accumulated bloat or after large refactors. Accepts optional flags in $ARGUMENTS: --dry-run, --orphans-only.
---

You are running the documentation weeder. Arguments provided: "$ARGUMENTS"

Parse $ARGUMENTS for flags:
- `--dry-run` → list candidates without prompting for deletion
- `--orphans-only` → faster scan, only check link reachability (skip content analysis)

**Step 1 — Gather all doc files**

```bash
find docs/ -name "*.md" 2>/dev/null | sort
find . -name "CLAUDE.md" -not -path "./.git/*" -not -path "./node_modules/*" -not -maxdepth 1 2>/dev/null | sort
ls *.md 2>/dev/null
```

**Step 2 — For each doc, gather signals**

```bash
# Creation commit (first commit touching the file)
git log --diff-filter=A --follow --format="%ai %an" -- <file> | tail -1

# Last modification date
git log --follow --format="%ai" -- <file> | head -1

# Total commit count (1 = never touched since creation)
git log --follow --oneline -- <file> | wc -l
```

**Step 3 — Assess each doc for weed signals**

Check these signals and label each doc:

- **orphaned**: not reachable from CLAUDE.md via any chain of links. Build a link graph: read CLAUDE.md, follow all `[text](path)` links, follow links from those docs, etc. Anything not in the reachable set is orphaned.
- **dead-refs**: contains markdown links or code references to source paths that no longer exist. For each internal link in the doc, check if the target file exists.
- **stub**: fewer than 15 non-empty lines, OR contains unfilled template placeholders like `{{...}}` or lines like `<!-- TODO -->` with no other content.
- **never-touched**: `git log --oneline` count is 1 (only the creation commit).
- **superseded**: another doc covers the same topic. Read pairs of docs that seem related by name or section headers and compare content similarity.
- **misplaced**: a plan or spec file in a non-standard location that should live under `docs/execution-plans/` or `docs/product-specs/`. Detection criteria: (a) any `.md` file under `plans/`, `specs/`, `features/`, `.agent/plans/`, `.agent/specs/`; OR (b) any `.md` file outside `docs/` containing 2+ plan-signal headings (`## Progress`, `## Milestones`, `## Decision Log`, `## Acceptance Criteria`) or spec-signal headings (`## User Story`, `## Problem Statement`, `## Proposed Solution`). Exclude forwarding stubs (content contains "has moved to") and `README.md`.
- **healthy**: none of the above.

Only flag docs with clear signals. When in doubt, mark as healthy.

**Step 4 — Present candidates**

If `--dry-run`, print the findings and stop:
```
Weed candidates:
  docs/old-auth-spec.md     orphaned, never-touched (142 days old)
  docs/product-specs/dark-mode.md  stub (6 lines, unfilled placeholders)
  ...
```

Otherwise, use the **AskUserQuestion tool** to present a multi-select. For each candidate include:
- File path
- Weed reason(s)
- Key facts: age, line count, last modifier

Format each option label as: `<path> — <reason> (<age> days old, <N> lines)`. For misplaced files, use: `<path> — misplaced → <destination> [migrate or delete]`

**Step 5 — Handle superseded docs specially**

When two docs have significant content overlap:
- Read both and summarize what each covers
- Present as: "docs/auth-v1.md covers X, Y. docs/auth-v2.md covers X, Y, Z. V1 appears to be a subset."
- Ask the user separately: delete v1, delete v2, or merge? If merge: draft the merged version and ask for confirmation before writing.

**Step 6 — Act on confirmed candidates**

For each confirmed candidate, check which signal it had:

**If misplaced (plan or spec in a non-standard location):** The user's selection label includes `[migrate or delete]`. Use AskUserQuestion to ask: "Migrate `<path>` to `<destination>`, or delete it?" with two options. Then:
- If **migrate**: apply the `/garden:harmonize` migration logic — read the file, append any missing ExecPlan sections (for plans), write to the destination, write a forwarding stub at the original path, and update the relevant catalogue (`docs/PLANS.md` or `docs/product-specs/index.md`).
- If **delete**: proceed to the deletion step below.

**For all other signal types (and misplaced files where user chose delete):**
```bash
git rm <file>
```

After each deletion, check if CLAUDE.md or ARCHITECTURE.md links to the deleted file. If so, remove those link lines and write the updated file.

**Step 7 — Log**

Append to `docs/gardening-log.md`:
```markdown
## YYYY-MM-DD — Weed Run

- **Removed:** <file> — <reason>
- **Kept:** <file> — user chose to keep
- **Merged:** <file-a> + <file-b> → <result>
```

Tell the user how many docs were removed and suggest running `/context-gardening:status` to confirm the garden is clean.
