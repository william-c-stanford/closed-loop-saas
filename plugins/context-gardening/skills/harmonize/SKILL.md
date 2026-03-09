---
description: Find plans and product specs in non-standard locations and migrate them into docs/execution-plans/ and docs/product-specs/ with full ExecPlan structure. Updates docs/PLANS.md and docs/product-specs/index.md catalogues. Use after /garden:init on a repo that already had plans or specs elsewhere, or any time you want to align scattered plan files with the context-gardening structure.
---

You are running the plan and spec harmonizer. Arguments provided: "$ARGUMENTS"

Parse $ARGUMENTS for flags:
- `--dry-run` → list candidates without migrating anything
- `--plans-only` → scan only for stray plans, skip specs
- `--specs-only` → scan only for stray specs, skip plans

**Step 1 — Check prerequisites**

Verify that `docs/PLANS.md` and `docs/product-specs/index.md` exist:

```bash
ls docs/PLANS.md docs/product-specs/index.md 2>/dev/null
```

If either file is missing, tell the user: "Run `/garden:init` first to scaffold the standard structure, then re-run `/garden:harmonize`." Stop here.

**Step 2 — Scan for stray plans**

Skip this step if `--specs-only` was passed.

Search for `.md` files that look like plans but are not already under `docs/execution-plans/`. A file is a candidate if it meets ANY of these criteria:

Location-based (check these directories and patterns):
- Any `.md` file under `plans/` at any depth
- Any `.md` file under `.agent/plans/` at any depth
- Any `.md` file under `docs/plans/` at any depth (a common intermediate location before full harmonization)
- Any `.md` file under `todos/` at any depth
- Root-level `PLANS.md` (not `docs/PLANS.md` — that is the catalogue, not a plan)
- Root-level files matching `*-plan.md` or `*.plan.md`

Content-based (scan all `.md` files, excluding `node_modules/`, `.git/`, and the standard destinations `docs/execution-plans/` and `docs/product-specs/`; `docs/plans/` is intentionally **not** excluded):
- Contains 2 or more of these headings: `## Progress`, `## Milestones`, `## Acceptance Criteria`, `## Decision Log`, `## Implementation Plan`, `## Implementation`

Exclude any file whose content contains the string "has moved to" (forwarding stub). Exclude `README.md`. Exclude files already under `docs/execution-plans/` (those are the destination, not candidates).

```bash
# Location-based: find candidates in known non-standard dirs
find plans/ .agent/plans/ docs/plans/ todos/ -name "*.md" 2>/dev/null
ls *-plan.md *.plan.md PLANS.md 2>/dev/null | grep -v "^ls:" || true

# Content-based: scan for plan-signal headings, excluding only the standard destinations
grep -rl "## Progress\|## Milestones\|## Decision Log\|## Implementation Plan\|## Acceptance Criteria" \
  --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=".git" \
  --exclude-dir=execution-plans --exclude-dir=product-specs \
  . 2>/dev/null
```

Deduplicate the combined list. For each candidate, read the file and confirm it is not a forwarding stub and not already under `docs/execution-plans/`.

**Step 3 — Scan for stray product specs**

Skip this step if `--plans-only` was passed.

Search for `.md` files that look like product specs but are not already under `docs/product-specs/`. A file is a candidate if it meets ANY of these criteria:

Location-based:
- Any `.md` file under `specs/` at any depth
- Any `.md` file under `features/` at any depth
- Any `.md` file under `.agent/specs/` at any depth

Content-based (for any `.md` file outside `docs/`, `node_modules/`, `.git/`):
- Contains 2 or more of these headings: `## User Story`, `## Problem Statement`, `## Proposed Solution`, `## Overview` (combined with `## Acceptance Criteria` in the same file)
- Does NOT also qualify as a stray plan (a file can only be one type; plans take priority)

Exclude forwarding stubs, `README.md`, and files already under `docs/product-specs/`.

```bash
find specs/ features/ .agent/specs/ -name "*.md" 2>/dev/null
grep -rl "## User Story\|## Problem Statement\|## Proposed Solution" \
  --include="*.md" \
  --exclude-dir=docs --exclude-dir=node_modules --exclude-dir=".git" \
  . 2>/dev/null
```

**Step 4 — Classify each candidate**

For each stray plan file, read its content and determine:

1. **Lifecycle stage** (active or completed):
   - Completed: `## Outcomes & Retrospective` section has substantive content (more than the placeholder "Populated at completion") AND the `## Progress` section shows all checkboxes checked (`- [x]`) or has no unchecked boxes (`- [ ]`)
   - Active: everything else (unchecked items, missing Progress section, missing Outcomes section)

2. **Gap list** — which of these required sections are missing:
   - `## Progress`
   - `## Decision Log`
   - `## Outcomes & Retrospective`

3. **Destination path**: `docs/execution-plans/active/<filename>` or `docs/execution-plans/completed/<filename>`

For each stray spec file, read its content and note whether it has a problem statement and acceptance criteria (informational only — specs have no required structural sections enforced by the linter).

**Step 5 — Present candidates to user**

If no candidates were found in Steps 2 and 3, report:
"No stray plans or product specs found. Your repository structure is already harmonized."
Then stop.

If `--dry-run` was passed, print the findings and stop:
```
Harmonize candidates:
  Plans:
    plans/feat-auth.md → docs/execution-plans/active/feat-auth.md  [active, missing: Decision Log, Outcomes & Retrospective]
    plans/feat-onboarding.md → docs/execution-plans/completed/feat-onboarding.md  [completed, no gaps]
  Specs:
    specs/dark-mode.md → docs/product-specs/dark-mode.md
```

Otherwise, use the **AskUserQuestion tool** with `multiSelect: true`. Present plans first, then specs. Each option label follows this format:

- For plans: `<current-path> → <destination>  [plan, <stage>, missing: <sections or "none">]`
- For specs: `<current-path> → docs/product-specs/<filename>  [spec]`

Always include a note that unselected files will be left in place.

**Step 6 — Migrate selected plans**

For each plan the user confirmed:

1. Read the current file content.

2. Determine which required sections are missing and append them. Use these exact placeholders (they satisfy the `check-plans.js` linter which checks for heading presence):

        ## Progress

        _No progress entries yet. Add checkboxes as work begins._

        ## Decision Log

        _No decisions recorded yet._

        ## Outcomes & Retrospective

        _Populated at completion._

   Only append the sections that are actually missing. Do not add duplicates.

3. Write the updated content to the destination path. Create the destination directory if it does not exist:

        mkdir -p docs/execution-plans/active
        mkdir -p docs/execution-plans/completed

4. Write a forwarding stub to the original file path (overwrite it):

        # [Moved] <original filename without extension>

        This plan has moved to [`<destination>`](<destination>).

        It was migrated by `/garden:harmonize` on <YYYY-MM-DD>.

5. Read `docs/PLANS.md`. Insert a new table row in the Active or Completed section. Infer a one-line summary from the plan's Purpose/Overview section or first paragraph. Row format:

        | [<title>](execution-plans/<stage>/<filename>.md) | <Active or Completed> | <YYYY-MM> | <summary> |

   Use Edit to insert the row after the table header line (after `|---|---|---|---|`) in the correct section. If the section contains only `_No plans yet._`, replace that line with the new row.

**Step 7 — Migrate selected specs**

For each spec the user confirmed:

1. Read the current file content.

2. Write the content to `docs/product-specs/<filename>.md`. Create the directory if needed.

3. Write a forwarding stub to the original path:

        # [Moved] <original filename without extension>

        This spec has moved to [`docs/product-specs/<filename>`](docs/product-specs/<filename>.md).

        It was migrated by `/garden:harmonize` on <YYYY-MM-DD>.

4. Read `docs/product-specs/index.md`. Insert a new row in the Active Specs table. Infer a one-line description from the spec's Overview or Problem Statement. Row format:

        | [<title>](<filename>.md) | Draft | <description> |

   Use Edit to insert after the table header. If the table contains only `*(none yet)*`, replace that line with the new row.

**Step 8 — Log and report**

Append to `docs/gardening-log.md` (create if it does not exist):

    ## <YYYY-MM-DD> — Harmonize Run

    - **Migrated plan:** <original-path> → <destination>  [<stage>, added sections: <list or "none">]
    - **Migrated spec:** <original-path> → docs/product-specs/<filename>
    - **Skipped:** <original-path> — user chose to keep in place
    - **No candidates found** (if applicable)

Tell the user:
- How many files were migrated (plans and specs separately)
- That forwarding stubs were written at the original paths
- To run `/garden:status` to confirm the linter is now clean
- That `docs/PLANS.md` and `docs/product-specs/index.md` have been updated
