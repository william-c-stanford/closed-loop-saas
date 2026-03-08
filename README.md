# closed-loop-saas

A marketplace of Claude Code plugins for building and maintaining closed-loop SaaS products — systems where AI agents can read, reason about, and modify the codebase with the same fluency a senior engineer would.

---

## The Idea

The premise is simple: **AI coding agents are only as good as their inputs.** If the codebase is opaque — implicit conventions, tribal knowledge, undocumented decisions — agents hit a ceiling quickly. If it's legible — structured context, explicit module boundaries, documented plans and decisions — agents compound.

Two pieces of engineering writing shaped this thinking directly:

**[Execution Plans for Codex](https://developers.openai.com/cookbook/articles/codex_exec_plans)** (OpenAI Developer Cookbook) introduced the ExecPlan format: structured living documents that anchor AI agents through multi-hour tasks. The key insight is that agents need not just instructions but *verifiable checkpoints* — a `## Progress` list they can update, a `## Decision Log` recording every choice and why, an `## Outcomes & Retrospective` at completion. Without this structure, long-horizon agents drift. With it, they can sustain coherent work across extended sessions and hand off cleanly between runs.

**[Harness Engineering with AI](https://openai.com/index/harness-engineering/)** (OpenAI) shows what happens when a real engineering team restructures its codebase for AI legibility at scale. The finding: productivity gains from AI agents are bounded by how well the codebase explains itself. Teams that invested in structured, agent-readable context saw compounding returns. Teams that relied on implicit knowledge hit a ceiling. The investment in documentation-as-infrastructure pays off not once but on every subsequent agent interaction.

The plugins in this marketplace operationalize these insights as Claude Code tooling.

---

## Installation

### Add the full marketplace

```
/plugin marketplace add william-c-stanford/closed-loop-saas
```

Then install individual plugins:

```
/plugin install context-gardening@closed-loop-saas
```

### Install a plugin directly from GitHub

```bash
git clone https://github.com/william-c-stanford/closed-loop-saas.git ~/claude-plugins/closed-loop-saas
```

Add to `~/.claude/settings.json`:

```json
{
  "plugins": [
    {
      "path": "~/claude-plugins/closed-loop-saas/plugins/context-gardening"
    }
  ]
}
```

### Fork and self-host

For teams who want to customize rules, add skills, or extend the linters — fork this repo and point your Claude Code settings at your fork. All plugins use plain Markdown SKILL files and pure Node.js linters, so customization requires no build step.

---

## Plugins

### [context-gardening](./plugins/context-gardening)

**Agent-legible repository knowledge management.**

The fundamental challenge with AI coding agents is context management: the entire codebase doesn't fit in context, so agents are always working with partial information. This plugin solves it with progressive disclosure — a hierarchy of documentation that loads only what's relevant, when it's relevant.

**How it works:**

- **Root `CLAUDE.md`** — a navigation map kept under 150 lines. Claude Code reads this at every session start. It points to everything else; it explains nothing in depth.
- **Module `CLAUDE.md` files** — thorough local style guides (patterns, types, gotchas, testing approach) that Claude Code lazy-loads automatically when it navigates into a module directory. No brevity pressure. They should be complete enough that an agent never needs to re-read source files to understand how the module works.
- **`docs/`** — the system of record for architecture, design decisions, plans, and specs.
- **ExecPlans** — living plan documents under `docs/execution-plans/active/` that implement the [OpenAI ExecPlan format](https://developers.openai.com/cookbook/articles/codex_exec_plans): `## Progress`, `## Decision Log`, `## Outcomes & Retrospective`.

**Enforcement:**

Five linter scripts run as pre-commit and pre-push git hooks, catching drift before it lands in the repo: CLAUDE.md line limit, broken doc links, stale freshness markers, uncatalogued plans, plans in non-standard locations, and docs unreachable from the nav map.

**In Claude Code sessions**, linter errors trigger an interactive `AskUserQuestion` prompt — Claude asks whether to run the fix skills automatically, skip, or save an auto-accept preference for future commits.

**At the terminal**, linter output includes `claude -p "/garden:skill"` commands that are directly copy-pasteable.

**Skills:**

| Command | What it does |
|---|---|
| `/garden:init` | Scaffold the full structure and install git hooks in any repo |
| `/garden:tend` | Update docs that have drifted; flag new stray plans/specs |
| `/garden:weed` | Prune stale, orphaned, or misplaced docs (interactive) |
| `/garden:harmonize` | Migrate plans/specs from non-standard locations into `docs/` |
| `/garden:status` | Knowledge base health dashboard |
| `/garden:scaffold-module` | Generate a `CLAUDE.md` stub for a new module |

**Zero runtime dependencies** — Claude Code is the AI layer. Linters use only Node.js built-ins.

→ [Full documentation](./plugins/context-gardening/README.md)

---

## Contributing

Each plugin lives in `plugins/<name>/`. A plugin is:

```
plugins/<name>/
  .claude-plugin/plugin.json   ← name, version, description
  skills/*/SKILL.md            ← slash commands (auto-discovered)
  hooks/hooks.json             ← Claude Code lifecycle hooks (optional)
  git-hooks/                   ← shell scripts installed into .git/hooks/ (optional)
  linters/                     ← Node.js lint scripts (optional)
  README.md
```

Skills are plain Markdown files — no build step, no SDK. Linters must use only Node.js built-ins so they install instantly with no `npm install`.

To add a plugin: create the directory structure, open a PR. Plugin descriptions in `marketplace.json` at the repo root are updated automatically on merge.
