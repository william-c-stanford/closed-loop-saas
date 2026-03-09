# closed-loop-saas

A marketplace of Claude Code plugins for teams building with AI agents.

---

## The Problem

Every time you start a new Claude Code session, it starts fresh. It doesn't remember that your team always uses service objects for business logic, that the `/api/v2` routes follow a different auth pattern than v1, or that the `payments` module has a quirk where you must never call the Stripe API directly — there's a wrapper for that.

So it re-reads the same files. It asks clarifying questions you've answered a dozen times. It makes decisions inconsistent with past ones. And the bigger your codebase gets, the worse this gets — because the more context there is to know, the less of it fits in a single session.

The same problem exists for AI agents doing longer, autonomous work. Without a clear record of what's been decided and why, they drift. They redo work. They make choices that conflict with earlier ones.

**This marketplace addresses that gap directly.** The plugins here give your codebase a structured memory — one that AI agents can read, navigate, and stay oriented by, session after session.

---

## How It Works

The core insight, drawn from [OpenAI's research on AI-assisted engineering at scale](https://openai.com/index/harness-engineering/), is simple: **the productivity you get from AI coding agents is bounded by how well your codebase explains itself.**

A codebase full of implicit conventions and tribal knowledge creates a ceiling. A codebase with structured, navigable, up-to-date context compounds — every agent interaction builds on the last.

The plugins in this marketplace make that compounding structure easy to create and maintain.

---

## Plugins

### [context-gardening](./plugins/context-gardening)

The flagship plugin. Run one command to give your codebase a permanent, structured memory that Claude reads automatically at the start of every session. As your code changes, a set of automated checks and AI-powered skills keep that memory accurate.

→ [Full documentation and setup guide](./plugins/context-gardening/README.md)

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

For teams who want to customize the rules or add skills — fork this repo and point your Claude Code settings at your fork. All plugins use plain Markdown SKILL files and pure Node.js linters, so customization requires no build step.

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
