# feat: context-gardening Claude Code Plugin

## Overview

A Claude Code plugin that enforces agent-legible repository knowledge management. The core insight from the OpenAI Codex team: the root context file should be a table of contents (~100 lines), not an encyclopedia. Knowledge lives in a structured `docs/` directory.

**Two-level context system:**
- **`CLAUDE.md`** at repo root — the map/TOC only (~100 lines), links to `docs/`
- **`AGENTS.md`** within module subdirectories — module-level style guides, coding conventions, and domain-specific rules (e.g., `src/auth/AGENTS.md`, `src/api/AGENTS.md`)

This plugin makes that pattern installable, enforceable, and self-maintaining in any repo.

**One command to install. Git hooks to enforce. A periodic AI agent to tend the garden.**

---

## Problem Statement

Large repos with AI agents suffer from documentation rot and context overload:

- Monolithic `CLAUDE.md` files balloon past 500+ lines — crowding out task context, with no module-level conventions
- Docs go stale silently — agents act on outdated architecture descriptions
- No mechanical enforcement — drift is inevitable without tooling
- Cross-references break — docs point to files that moved or were renamed
- New engineers (human or AI) lack a navigable entry point to the codebase

The `context-gardening` plugin solves this by treating docs as a first-class system of record with linting, structure enforcement, and a self-healing AI gardener agent.

---

## Proposed Solution

An installable Claude Code plugin that provides:

1. **`/garden:init`** — scaffolds the full knowledge structure in any existing repo, analyzing existing code to bootstrap content
2. **Pre-commit hooks** — lightweight validation on every commit (pure shell/Node, no AI)
3. **Pre-PR / CI linting** — stricter cross-link and coverage validation
4. **`/garden:tend`** — AI agent that diffs code changes and updates stale docs
5. **`/garden:weed`** — finds extraneous/irrelevant docs and presents an interactive TUI for the user to prune them
6. **`/garden:status`** — health dashboard for the knowledge base
7. **`/garden:scaffold-module <path>`** — generates a module-level `AGENTS.md` stub

---

## Technical Architecture

### Architecture: Claude Code-Native

This plugin is **entirely Claude Code-native**. There is no outbound Anthropic SDK usage, no npm binary for AI operations. The architecture splits cleanly into two layers:

**Layer 1 — Deterministic linters (shell scripts, no AI)**
Pure bash/Node.js scripts that run as git hooks. Fast, offline, no model calls. These do mechanical checks: line counts, link resolution, frontmatter parsing, freshness markers.

**Layer 2 — AI operations (Claude Code skills)**
The intelligent commands (`/garden:init`, `/garden:tend`, `/garden:weed`, `/garden:status`) are SKILL.md definitions. When invoked, **Claude itself is the agent** — it reads diffs, analyzes docs, drafts updates, and writes files using its built-in tools (Bash, Read, Write, Edit, Glob, Grep). No external API calls.

### Plugin Structure

```
context-gardening/               # this repo — a Claude Code plugin
├── SKILL.md                     # defines all /garden:* slash commands
├── README.md
├── linters/
│   ├── check-claude-md.js       # CLAUDE.md line count + link validation
│   ├── check-module-agents.js   # per-module AGENTS.md structure validation
│   ├── check-cross-links.js     # bidirectional link checker
│   ├── check-freshness.js       # staleness marker checker
│   ├── check-coverage.js        # staged source files vs doc changes
│   └── run-all.js               # orchestrator, called by git hooks
├── hooks/
│   ├── pre-commit               # shell: node linters/run-all.js --pre-commit
│   └── pre-push                 # shell: node linters/run-all.js --pre-push
├── templates/
│   ├── CLAUDE.md.md             # root TOC template (plain markdown with {{placeholders}})
│   ├── module-AGENTS.md.md      # per-module style guide template
│   ├── ARCHITECTURE.md.md
│   └── docs/
│       ├── DESIGN.md.md
│       ├── FRONTEND.md.md

│       ├── PRODUCT_SENSE.md.md
│       ├── QUALITY_SCORE.md.md
│       ├── RELIABILITY.md.md
│       ├── SECURITY.md.md
│       ├── design-docs/index.md.md
│       ├── design-docs/core-beliefs.md.md
│       └── product-specs/index.md.md
├── github-actions/
│   └── garden-ci.yml            # reusable GitHub Actions workflow
└── .garden/
    └── config.schema.json       # JSON schema for .garden/config.json
```

### How the AI Skills Work

When a user runs `/garden:tend` inside Claude Code:

```
User: /garden:tend

Claude (following SKILL.md instructions):
  1. Bash: cat .garden/last-tended.json → get last SHA
  2. Bash: git log <sha>..HEAD --name-only → changed files
  3. Glob: find all docs/**/*.md + */AGENTS.md
  4. [for each changed source file] → map to candidate docs
  5. Read: current content of each candidate doc
  6. [reason about what changed and what's stale]
  7. Edit/Write: update stale docs with minimal changes
  8. Bash: git add <updated docs>
  9. Write: append entry to docs/gardening-log.md
  10. Write: update .garden/last-tended.json with current SHA
```

No API calls. Claude is already running — it just follows structured instructions from SKILL.md and uses tools it already has.

### Target Repo Structure (after `garden init`)

```
<target-repo>/
├── CLAUDE.md                    # TOC/map only, ~100 lines, links to docs/
│                                # (read by Claude Code at session start)
├── ARCHITECTURE.md              # top-level domain + package map
├── src/
│   ├── auth/
│   │   ├── AGENTS.md            # auth module: style guide, patterns, rules
│   │   └── ...
│   ├── api/
│   │   ├── AGENTS.md            # api module: REST conventions, error formats
│   │   └── ...
│   └── billing/
│       ├── AGENTS.md            # billing module: compliance rules, patterns
│       └── ...
├── docs/
│   ├── DESIGN.md                # design philosophy
│   ├── FRONTEND.md              # frontend conventions
│   ├── PRODUCT_SENSE.md         # product principles
│   ├── QUALITY_SCORE.md         # domain quality grades
│   ├── RELIABILITY.md           # SLOs, runbooks index
│   ├── SECURITY.md              # security posture
│   ├── design-docs/
│   │   ├── index.md             # catalogue with verification status
│   │   └── core-beliefs.md      # agent-first operating principles
│   ├── generated/
│   │   └── db-schema.md         # auto-generated, never hand-edited
│   ├── product-specs/
│   │   └── index.md
│   └── references/              # llms.txt files, external ref docs
└── .garden/
    ├── config.json              # plugin config
    └── last-tended.json         # timestamp + commit SHA for gardener
```

**The two-level context hierarchy:**

| File | Location | Purpose | Size limit |
|---|---|---|---|
| `CLAUDE.md` | repo root | Navigation map, links to docs/ | ~100 lines |
| `AGENTS.md` | per module dir | Style guide, conventions, rules for that module | ~150 lines |

When Claude Code opens a session, it reads `CLAUDE.md` (the map). When it navigates into `src/auth/`, it reads `src/auth/AGENTS.md` (the local rules). Progressive disclosure in practice.

---

## Implementation Phases

### Phase 1: Core Scaffolding (`/garden init`)

**Goal:** A single command transforms any repo into an agent-legible knowledge base.

**How it works:** `/garden:init` is a Claude Code skill. When invoked, Claude runs Bash commands to inspect the repo, then uses its Write/Edit tools to create files from the templates in `templates/`. Claude fills in the placeholders itself by reasoning about what it found.

**Tasks:**

- [ ] Write `templates/CLAUDE.md.md` — root TOC template with `{{repo_name}}`, `{{modules}}`, `{{date}}` placeholders
- [ ] Write `templates/module-AGENTS.md.md` — per-module style guide template
- [ ] Write `templates/ARCHITECTURE.md.md`, `templates/docs/*.md.md` — all doc templates
- [ ] Write the `/garden:init` section of `SKILL.md` with instructions for Claude to:
  - Run `ls`, `cat package.json` / `pyproject.toml` / `Gemfile` / `go.mod` to detect stack
  - Find existing README, docs, CLAUDE.md to avoid clobbering
  - Identify top-level source directories (for module AGENTS.md stubs)
  - Read each template and fill placeholders based on what it found
  - Write files with `<!-- garden-managed -->` marker
  - Copy `hooks/pre-commit` and `hooks/pre-push` into `.git/hooks/` and `chmod +x`
  - Create `.garden/config.json` with defaults + detected `source_dirs`
  - Offer to copy `github-actions/garden-ci.yml`
- [ ] Write `linters/run-all.js` — tiny Node.js orchestrator (no deps) called by git hooks

**Acceptance Criteria:**

- [ ] `npx context-gardening init` works in any git repo
- [ ] Generated `CLAUDE.md` is ≤ 150 lines and links to all generated docs
- [ ] Per-module `AGENTS.md` stubs generated for detected top-level source modules
- [ ] All generated docs have correct `<!-- garden-managed -->` markers
- [ ] Git hooks installed and functional
- [ ] `.garden/config.json` created with sensible defaults
- [ ] Dry-run shows all planned file creations without writing

**Example `.garden/config.json`:**

```json
{
  "version": "1",
  "claude_md_max_lines": 150,
  "module_md_max_lines": 150,
  "module_md_required_above_file_count": 10,
  "freshness_warn_days": 30,
  "freshness_error_days": 90,
  "doc_coverage_mode": "warn",
  "gardener": {
    "model": "claude-opus-4-6",
    "auto_pr": false,
    "auto_stage": true,
    "schedule": "weekly"
  },
  "source_dirs": ["src", "app", "lib"],
  "generated_docs": ["docs/generated/db-schema.md"],
  "ignore_paths": ["node_modules", ".git", "dist", "build"]
}
```

---

### Phase 2: Pre-commit Linter

**Goal:** Fast, local validation on every commit. Should complete in <2s.

**Checks (pre-commit — soft by default, configurable to hard-fail):**

| Check | Mode | File(s) | Description |
|---|---|---|---|
| `claude-md-length` | error | `CLAUDE.md` | Root file ≤ config `claude_md_max_lines` |
| `claude-md-links` | error | `CLAUDE.md` | All links resolve to real files |
| `module-agents-md-length` | error | `*/AGENTS.md` | Module files ≤ config `module_md_max_lines` |
| `module-agents-md-required` | warn | `*/AGENTS.md` | Modules with >N files should have AGENTS.md |
| `doc-coverage` | warn | `docs/**` | If `src/**` changed but no `docs/**` changed, warn |
| `freshness-marker` | warn | `docs/**/*.md` | Docs with `<!-- last-reviewed: -->` older than threshold |

**Tasks:**

- [ ] Build `src/linters/claude-md.js`:
  - Count lines (strip blank lines at end)
  - Extract all `[text](path)` and `[text](../path)` links
  - Resolve relative to repo root, check file existence
  - Enforce: CLAUDE.md must not duplicate content that belongs in docs/ or module AGENTS.md
- [ ] Build `src/linters/module-agents-md.js`:
  - Walk `src_dirs` config, find all subdirectories with >N source files
  - Check each has an `AGENTS.md`; warn on missing ones
  - Validate present AGENTS.md files: line count, required sections (Style, Conventions, Patterns)
  - Detect modules that changed code but have stale AGENTS.md (git mtime heuristic)
- [ ] Build `src/linters/coverage.js`:
  - Get staged files from git: `git diff --cached --name-only`
  - Check if any `src_dirs` files are staged
  - Check if any `docs/` files are staged
  - Emit warning if source changed with no doc change
- [ ] Build `src/linters/freshness.js`:
  - Parse `<!-- last-reviewed: YYYY-MM-DD -->` markers
  - Compute days since review
  - Warn/error based on config thresholds
- [ ] Write `hooks/pre-commit` shell script:
  ```bash
  #!/bin/sh
  garden lint --pre-commit
  ```
- [ ] Build `garden lint` command that runs appropriate checks and formats output

**Example Output:**

```
garden lint (pre-commit)
  OK   claude-md-length          (87 lines)
  OK   claude-md-links           (12 links checked)
  OK   module-agents-md-length   (3 module AGENTS.md files checked)
  WARN module-agents-md-required src/billing/ has 14 files but no AGENTS.md
       → Run: garden scaffold-module src/billing/
  WARN doc-coverage              src/auth/oauth.js staged, no docs/ changes
       → Consider updating docs/SECURITY.md or src/auth/AGENTS.md
  WARN freshness-marker          docs/RELIABILITY.md last-reviewed 45 days ago

0 errors, 3 warnings. Warnings are non-blocking.
```

---

### Phase 3: Pre-PR / CI Linter

**Goal:** Stricter validation gate before code merges. Runs in GitHub Actions.

**Additional checks (pre-push / CI):**

| Check | Mode | Description |
|---|---|---|
| `cross-links` | error | All doc-to-doc links are bidirectional and resolve |
| `quality-score-sync` | warn | QUALITY_SCORE.md updated if domain docs changed |
| `claude-md-toc-sync` | error | `CLAUDE.md` TOC matches actual `docs/` structure |
| `module-agents-md-coverage` | warn | All modules with >10 files have an `AGENTS.md` |

**Tasks:**

- [ ] Build `src/linters/cross-links.js`:
  - Walk all `docs/**/*.md` files
  - Extract all markdown links pointing to other docs
  - Build bidirectional link graph
  - Report broken links and unreferenced orphan docs
- [ ] Build `src/linters/coverage.js` PR extensions:
  - Get PR diff via `git diff origin/main...HEAD --name-only`
  - Check for doc changes corresponding to changed source files
- [ ] Build `src/linters/toc-sync.js`:
  - Parse links from `CLAUDE.md`
  - Walk actual `docs/**` structure
  - Report docs not linked from `CLAUDE.md` (orphans)
  - Report `CLAUDE.md` links with no corresponding file
  - Also validate that module `AGENTS.md` files are referenced from `CLAUDE.md` (or ARCHITECTURE.md)
- [ ] Write `github-actions/garden-ci.yml`:

```yaml
# github-actions/garden-ci.yml
name: Garden CI
on: [pull_request]
jobs:
  garden-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx context-gardening lint --ci
```

---

### Phase 4: Doc-Gardener Agent (`/garden tend`)

**Goal:** Periodic AI agent that keeps docs in sync with code changes.

**Architecture:**

```
garden tend
  │
  ├── 1. Load .garden/last-tended.json (timestamp + commit SHA)
  ├── 2. Get git log since last-tended: changed files + commit messages
  ├── 3. Map changed source files → related docs (via config + heuristics)
  ├── 4. For each potentially stale doc:
  │       ├── Read current doc content
  │       ├── Read changed source files
  │       ├── Call Claude API with diff + doc content
  │       └── Receive: { needs_update: bool, draft: string, rationale: string }
  ├── 5. For generated/ docs: regenerate automatically
  │       └── db-schema.md: introspect DB or parse migration files
  ├── 6. Stage or PR updated docs
  └── 7. Write gardening-log.md entry + update last-tended.json
```

**How it works:** `/garden:tend` is a Claude Code skill. Claude runs git commands to find what changed since the last run, reads potentially stale docs, reasons about what needs updating, and writes changes — all using built-in tools. No SDK, no API key.

**Tasks:**

- [ ] Write the `/garden:tend` section of `SKILL.md` with step-by-step instructions for Claude:
  1. `Bash: cat .garden/last-tended.json` → get `last_sha` and `last_run` date
  2. `Bash: git log <last_sha>..HEAD --name-only --oneline` → changed files + commit messages
  3. Map changed source files to candidate docs using config + heuristics (always include module's `AGENTS.md`)
  4. `Read` each candidate doc + relevant changed source files
  5. For each: reason about what the code changes imply for that doc
  6. If stale: `Edit` the doc with a minimally invasive update (preserve tone, structure)
  7. Skip sections marked `<!-- garden-managed: manual -->`
  8. `Bash: git add <updated docs>`
  9. Append a run summary to `docs/gardening-log.md`
  10. `Write: .garden/last-tended.json` with current HEAD SHA + timestamp
- [ ] Add `--dry-run` variant in SKILL.md: Claude prints what it *would* update but doesn't write
- [ ] Add `--pr` variant in SKILL.md: Claude runs `gh pr create` after staging changes
- [ ] Add `--since <date>` variant: Claude uses `git log --since=<date>` instead of SHA
- [ ] Document the **generated docs** workflow in SKILL.md:
  - Django migrations → Claude reads `migrations/` files, rewrites `docs/generated/db-schema.md`
  - Rails `db/schema.rb` → same
  - Prisma `schema.prisma` → same
  - Claude detects which ORM is present from stack analysis

---

### Phase 5: Weed Command (`/garden:weed`)

**Goal:** Find and interactively prune documentation that is no longer relevant — orphaned plans, AI-generated bloat, docs for deleted features, duplicate coverage.

This is distinct from `/garden:tend` (which updates stale content). Weeding removes docs that have no business existing anymore.

**What makes a doc a weed candidate:**

| Signal | Description |
|---|---|
| **Orphaned** | Not linked from `CLAUDE.md`, `ARCHITECTURE.md`, or any other doc |
| **Dead references** | References source files, modules, or features that no longer exist |
| **Superseded** | Content duplicated or replaced by a newer doc |
| **Empty or stub** | Doc has <10 lines of actual content (generated placeholder never filled in) |
| **No git activity** | File never modified since creation (AI-generated, never touched) |

**How it works in Claude Code:**

Claude Code has an `AskUserQuestion` tool that renders a native multi-select TUI. The skill uses this to present the weed candidates interactively — the user checks which ones to delete, and Claude deletes only those.

```
/garden:weed

Scanning 47 docs for weed candidates...

Found 8 candidates:

[ ] docs/design-docs/old-websocket-spec.md
    → Orphaned. Last modified 142 days ago. References src/ws/ (deleted).

[ ] docs/product-specs/dark-mode.md
    → Stub (6 lines). Never modified since creation (AI-generated 2026-01-14).

[ ] docs/references/stripe-v1-llms.txt
    → References Stripe v1 API. Current integration uses v3.

[ ] docs/design-docs/auth-flow-v1.md
    → Superseded by docs/design-docs/auth-flow-v2.md (95% content overlap).

[x] docs/FRONTEND.md              → Keep (linked, recently updated)
[x] docs/SECURITY.md              → Keep (linked, recently updated)

Select docs to delete (space to toggle, enter to confirm):
```

**Tasks:**

- [ ] Write the `/garden:weed` section of `SKILL.md` with instructions for Claude to:
  1. `Glob`: find all `**/*.md` files in `docs/` and module dirs
  2. `Bash: git log --name-only --diff-filter=A` to get creation date + author of each doc
  3. `Bash: git log --follow --format="%ai" -- <file> | tail -1` to get last modification date
  4. Build a cross-reference map: which docs are linked from which other docs
  5. For each doc, check:
     - Is it reachable from `CLAUDE.md` (directly or transitively)?
     - Does it reference source paths/modules that still exist? (`Glob` to verify)
     - Is it a stub? (line count, content density check)
     - Does a newer doc cover the same topic? (Read both, compare)
  6. Score each doc: `orphaned`, `dead-refs`, `stub`, `superseded`, `completed-plan`, `healthy`
  7. Use `AskUserQuestion` (multi-select) to present weed candidates to the user
  8. For confirmed deletes: `Bash: git rm <file>` (stages the deletion)
  9. Update `CLAUDE.md` TOC to remove links to deleted docs
  11. Log weeding session to `docs/gardening-log.md`

- [ ] Handle the **superseded detection** case carefully:
  - Read both docs when content overlap is suspected
  - Present a side-by-side summary: "doc A covers X, Y, Z — doc B covers X, Y, Z, W — A appears to be a subset"
  - Let user choose: delete A, delete B, or merge (Claude drafts the merge)

- [ ] Add `--dry-run` flag: list candidates without interactive prompt, just print findings

- [ ] Add `--orphans-only` flag: faster scan, only checks link reachability (skips content analysis)

**Example SKILL.md interaction flow:**

```
Claude: I found 8 weed candidates. Let me show you each one with context.

[Presents AskUserQuestion multi-select with each candidate labeled by its
weed reason and key facts: age, links in/out, what it references]

User: [selects 5 to delete, keeps 3]

Claude: Deleting 5 docs and updating CLAUDE.md TOC to remove broken links.
        Done. 5 files removed, CLAUDE.md updated.
```

---

### Phase 6: Status Dashboard & Plan Command

**`/garden status`**

```
garden status

Root Context
─────────────────────────────────────────────────────
  CLAUDE.md              87 lines    OK  (map/TOC)

Module AGENTS.md Coverage
─────────────────────────────────────────────────────
  src/auth/AGENTS.md     142 lines   OK  (12 days)
  src/api/AGENTS.md      98 lines    OK  (3 days)
  src/billing/           MISSING     WARN → run: garden scaffold-module src/billing/
  src/core/AGENTS.md     67 lines    OK

Global Docs Freshness
─────────────────────────────────────────────────────
  docs/DESIGN.md         freshness   WARN (62 days)
  docs/SECURITY.md       freshness   OK  (12 days)
  docs/QUALITY_SCORE.md  freshness   ERROR (95 days)

Cross-Link Coverage
  12 docs total, 2 orphans (not linked from CLAUDE.md or ARCHITECTURE.md):
    docs/design-docs/old-auth-flow.md
    docs/references/deprecated-api.txt

Last Gardening Run: 5 days ago (2026-03-02)
Docs tended: 3  |  Skipped: 8  |  PRs opened: 0
```

**How it works:** `/garden:status` instructs Claude to run the linter scripts and format their JSON output as a readable dashboard.

**Tasks:**

- [ ] Write the `/garden:status` section of `SKILL.md`:
  - Claude runs `node linters/run-all.js --status` to get JSON output from all linters
  - Formats into a readable dashboard with OK/WARN/ERROR per check
  - Reads `.garden/last-tended.json` to show time since last gardening run
- [ ] Add `--json` flag support to `linters/run-all.js` for machine-readable output (CI badges)
- [ ] Write the `/garden:scaffold-module <path>` section of `SKILL.md`:
  - Claude reads files in the target module directory
  - Fills in the `templates/module-AGENTS.md.md` template based on what it finds
  - Writes `<path>/AGENTS.md`

---

### Phase 6: SKILL.md Polish & Claude Code Hooks

SKILL.md is the primary artifact of this entire plugin — it's what makes all the AI commands work. This phase polishes it and adds the in-session hook that nudges Claude during normal coding.

**Tasks:**

- [ ] Write `SKILL.md` defining Claude Code slash commands:
  - `/garden:init` — scaffolds docs structure in current repo
  - `/garden:tend` — **manually triggers the doc-gardener agent** to update stale docs
  - `/garden:weed` — finds extraneous docs, presents interactive multi-select TUI for pruning
  - `/garden:status` — shows health dashboard inline
  - `/garden:scaffold-module <path>` — generates `AGENTS.md` stub for a specific module dir

- [ ] Write `.claude/settings.json` hooks:
  - `PostToolUse` on `Write`/`Edit` tools: check if source file was edited without a docs edit → remind agent to update docs
  - This creates an in-session nudge for Claude itself

  ```json
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "garden lint --hook --file $TOOL_OUTPUT_PATH 2>/dev/null || true"
        }]
      }]
    }
  }
  ```

---

## Freshness Marker Convention

Docs can opt into explicit freshness tracking:

```markdown
<!-- last-reviewed: 2026-02-20 -->
<!-- garden-managed: auto -->   # gardener can update this section
<!-- garden-managed: manual --> # gardener skips this section
```

---

## CLAUDE.md Template (Generated Root File)

```markdown
# Repository Guide

> This file is a navigation map, not a manual. Follow the links for depth.
> Keep this file under 150 lines. Last updated: {{date}}

## What This Repo Does

{{repo_description}}

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for domain map and package layering.

Key domains: {{domain_list}}

## Module Guides

Each source module has its own `AGENTS.md` with local style guides and conventions.

| Module | Guide | Purpose |
|---|---|---|
{{#each modules}}
| `{{path}}/` | [{{path}}/AGENTS.md](./{{path}}/AGENTS.md) | {{description}} |
{{/each}}

## Documentation Index

| Document | Purpose |
|---|---|
| [docs/DESIGN.md](./docs/DESIGN.md) | Design philosophy and principles |
| [docs/FRONTEND.md](./docs/FRONTEND.md) | Frontend conventions |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security posture and auth patterns |
| [docs/RELIABILITY.md](./docs/RELIABILITY.md) | SLOs, error handling, runbooks |
| [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md) | Domain quality grades |
| [docs/PRODUCT_SENSE.md](./docs/PRODUCT_SENSE.md) | Product principles |

## Design Documentation

See [docs/design-docs/index.md](./docs/design-docs/index.md) for full catalogue.

Core beliefs: [docs/design-docs/core-beliefs.md](./docs/design-docs/core-beliefs.md)

## Generated Docs

Schema reference: [docs/generated/db-schema.md](./docs/generated/db-schema.md)
(Auto-generated by `garden tend`. Do not edit manually.)

## External References

See [docs/references/](./docs/references/) for llms.txt files and external specs.

## Gardening

This repo uses [context-gardening](https://github.com/williamstanford/context-gardening).
Run `garden status` to see knowledge base health.
Run `garden tend` to update stale docs.
```

## Module AGENTS.md Template (Generated Per-Module)

```markdown
# {{module_name}} Module Guide

> Local style guide and conventions for this module.
> Keep this file focused and under 150 lines.
> Last updated: {{date}}

## Purpose

{{module_description}}

## Coding Conventions

- {{convention_1}}
- {{convention_2}}

## Patterns Used

<!-- Describe recurring patterns specific to this module -->

## What Belongs Here

<!-- What types of code/concerns live in this module -->

## What Doesn't Belong Here

<!-- Anti-patterns and concerns that should live elsewhere -->

## Key Dependencies

<!-- External libs or internal modules this depends on, and why -->

## Testing Approach

<!-- Module-specific testing patterns and conventions -->

## Related Docs

- [docs/DESIGN.md](../../docs/DESIGN.md)
- [docs/SECURITY.md](../../docs/SECURITY.md) <!-- if applicable -->
```

---

## Source-to-Doc Mapping Heuristics

The gardener uses these rules (plus custom config) to map code changes to docs:

| Source Pattern | Module AGENTS.md | Global Doc |
|---|---|---|
| `src/auth/**`, `**/oauth*`, `**/jwt*` | `src/auth/AGENTS.md` | `docs/SECURITY.md` |
| `src/api/**`, `**/routes*`, `**/endpoints*` | `src/api/AGENTS.md` | `docs/DESIGN.md` |
| `**/migrations/**`, `**/schema.*` | — | `docs/generated/db-schema.md` |
| `src/components/**`, `**/ui/**` | `src/components/AGENTS.md` | `docs/FRONTEND.md` |
| `**/tests/**`, `**/spec/**` | — | `docs/RELIABILITY.md` |
| `package.json`, `pyproject.toml` | — | `ARCHITECTURE.md` |
| `**/deploy/**`, `**/infra/**` | — | `docs/RELIABILITY.md` |

The gardener checks both the module `AGENTS.md` **and** the relevant global doc for every code change.

Custom mappings in `.garden/config.json`:
```json
{
  "source_doc_mappings": [
    { "source": "app/models/**", "docs": ["docs/generated/db-schema.md", "docs/DESIGN.md"] },
    { "source": "app/controllers/billing/**", "docs": ["docs/product-specs/billing.md"] }
  ]
}
```

---

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gardener agent produces hallucinated doc updates | Medium | Dry-run default, human review mode, small targeted diffs |
| Pre-commit hooks slow down git workflow | Low | Hooks must complete <2s; skip on `--no-verify` |
| AGENTS.md line limit too rigid for large repos | Medium | Configurable limit; plugin warns, doesn't block by default |
| Freshness markers become cargo-culted | Medium | Auto-update markers when gardener touches a doc |
| Plugin breaks in repos with unusual structure | Low | Graceful degradation; `--skip-checks` escape hatch |

---

## Dependencies

**Zero runtime dependencies for AI operations.** Claude Code is the AI layer.

**Linter scripts (pure Node.js built-ins only):**
- `fs`, `path`, `child_process` — all built into Node.js
- No npm packages required for linting

**Optional peer tools (detected at runtime, never required):**
- `gh` CLI — for `garden tend --pr` to open pull requests
- `node` ≥18 — to run linter scripts from git hooks

**Dev:**
- `vitest` — unit tests for linter scripts
- `mock-fs` — filesystem mocking for linter tests

This means: no `npm install` needed to use the plugin. The git hooks call Node.js directly with built-in modules only. The AI commands run entirely within the user's existing Claude Code session.

---

## Future Considerations

- **VS Code / Cursor extension** — surface garden status inline as doc annotations
- **`garden score`** — freshness score as a GitHub status check (0-100)
- **Multi-repo mode** — gardener that tends a monorepo with per-package docs
- **Slack/Discord notifications** — alert when critical docs go stale
- **LLMs.txt generation** — auto-generate `docs/references/this-repo-llms.txt` for external agents consuming this repo
- **WASM linter** — compile linters to WASM for browser-based CI environments

---

## Documentation Plan

Files created by this plugin in target repos:
- `AGENTS.md`, `ARCHITECTURE.md`, `docs/**` — all scaffolded by `garden init`
- `docs/gardening-log.md` — maintained by `garden tend`

Files in this plugin's own repo:
- `README.md` — installation, quick start, command reference
- `docs/design-docs/core-beliefs.md` — plugin's own agent-first principles
- `ARCHITECTURE.md` — plugin's own domain map

---

## Acceptance Criteria

### Functional

- [ ] `npx context-gardening init` scaffolds full docs structure in <10 seconds
- [ ] Generated `CLAUDE.md` is ≤ 150 lines with working links to all docs and module AGENTS.md files
- [ ] Per-module `AGENTS.md` stubs generated for all detected top-level source modules
- [ ] Pre-commit hook catches `CLAUDE.md` and module `AGENTS.md` violations before commit lands
- [ ] Pre-commit hook completes in <2 seconds on a 500-file repo
- [ ] `garden tend --dry-run` shows proposed doc updates without writing
- [ ] `garden tend` produces valid markdown updates when run against a repo with 30 days of uncommitted doc drift
- [ ] `garden status` renders health dashboard with freshness scores and orphan detection
- [ ] `/garden:weed` correctly identifies orphaned, stub, and dead-reference docs
- [ ] `/garden:weed` presents interactive multi-select and only deletes user-confirmed docs

### Non-Functional

- [ ] Plugin installs via `npm install -g context-gardening` or `npx`
- [ ] Works on macOS, Linux, Windows (WSL)
- [ ] No required config — sensible defaults for everything
- [ ] Gardener agent respects `<!-- garden-managed: manual -->` sections
- [ ] Linters emit warnings (not errors) by default for coverage checks; errors only for structural violations
- [ ] All linter output is parseable JSON with `--json` flag

### Quality Gates

- [ ] Unit tests for all linters (mock-fs)
- [ ] Integration test: `garden init` on a fresh Next.js repo scaffold
- [ ] Integration test: `garden tend` produces expected output on fixture diffs
- [ ] SKILL.md skill works end-to-end in Claude Code

---

## References & Research

### Source Material

- OpenAI Codex blog post on repository knowledge management (article in feature description)
- Claude Code hooks documentation: `.claude/settings.json` hook system
- Anthropic SDK: `@anthropic-ai/sdk` Node.js client

### Related Patterns

- `llms.txt` standard — structured context for AI agents consuming a codebase
- `lefthook` / `husky` — git hook managers this plugin can integrate with

### Similar Tools

- `danger-js` — PR linting framework (inspiration for pre-PR checks)
- `Vale` — prose linter (inspiration for doc structure validation)
- `repo-gardener` — Ruby gem for automated dependency PRs (inspiration for gardener agent pattern)
