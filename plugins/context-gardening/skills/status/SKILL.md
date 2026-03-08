---
description: Show a knowledge base health dashboard. Displays CLAUDE.md line count, per-module CLAUDE.md coverage, doc freshness, cross-link orphans, and the last gardening run summary. Use to assess overall documentation health or before deciding whether to run /tend or /weed.
---

You are showing the garden status dashboard.

**Step 1 — Run the linters**

```bash
node .garden/linters/run-all.js --status --json
```

If `.garden/linters/` doesn't exist, tell the user to run `/context-gardening:init` first and stop.

**Step 2 — Read gardening state**

```bash
cat .garden/last-tended.json 2>/dev/null || echo "Never tended"
cat docs/gardening-log.md 2>/dev/null | tail -20 || echo "No gardening log"
```

**Step 3 — Format and display the dashboard**

Parse the JSON from the linter and render in this format:

```
Garden Status — <repo-name>
════════════════════════════════════════════════════

Root Context
  CLAUDE.md              <N> lines    <OK/WARN/ERROR>

Module CLAUDE.md Coverage
  <module>/CLAUDE.md     <N> lines    OK  (<N> days since last change)
  <module>/              MISSING      WARN → run: /context-gardening:scaffold-module <module>/

Global Docs Freshness
  docs/DESIGN.md         <N> days     <OK/WARN/ERROR>
  docs/SECURITY.md       <N> days     OK
  ...

Cross-Link Coverage
  <N> docs total, <N> orphan(s) not reachable from CLAUDE.md

Last Garden Run
  <date> — <N> docs tended, <N> skipped
  (or: Never — run /context-gardening:tend to sync docs with code)

════════════════════════════════════════════════════
Recommended Actions
  1. <most important action based on results>
  2. <second action if needed>
```

**Step 4 — Always give 1-3 specific recommendations**

Base recommendations on what the linters actually found:
- If CLAUDE.md is over the line limit → "Trim CLAUDE.md — move detail to docs/"
- If modules are missing CLAUDE.md → "Run `/context-gardening:scaffold-module <path>` for <module>"
- If orphaned docs found → "Run `/context-gardening:weed` to find and remove irrelevant docs"
- If docs are stale → "Run `/context-gardening:tend` — last gardened <N> days ago"
- If everything is green → "Garden is healthy. Next tend in <X> days."
