---
description: Generate a thorough CLAUDE.md for a specific source module directory. Reads the module's source files to infer purpose, architecture, patterns, types, conventions, and gotchas, then writes a filled-in template. Claude Code natively lazy-loads nested CLAUDE.md files when it navigates into a directory — these should be detailed local style guides, not stubs. Use when a module has grown large enough to warrant its own local guide, or when /status reports a module is missing CLAUDE.md. Pass the module path as the argument.
---

You are scaffolding a CLAUDE.md for the module at: "$ARGUMENTS"

If $ARGUMENTS is empty, ask the user: "Which module directory should I scaffold? (e.g., src/auth/)"

The goal is a **thorough, useful reference** — not a brief stub. The root `CLAUDE.md` is intentionally
short (~150 lines) because it is loaded at every session start. This module guide is only loaded when
someone navigates into this directory, so it should contain everything a contributor needs to work
here confidently without re-reading the source code. There is no line budget to optimize for. Write
as much as is accurate and useful.

**Step 1 — Read the module comprehensively**

```bash
ls -la "$ARGUMENTS"
find "$ARGUMENTS" -not -path "*/node_modules/*" -not -name "*.md" | head -60
```

Read as many source files as needed to develop a confident understanding — aim for 10-20 files
minimum in a large module. Prioritise in this order:
1. Entry point or index file (usually `index.ts`, `mod.rs`, `__init__.py`, `<module>.go`, etc.)
2. Files with the most imports from other files in this module (central types/interfaces)
3. Files whose names suggest they define core patterns (repository, service, handler, controller)
4. A representative example of each distinct file type in the module

Skip generated files, migration files, and lockfiles. Read test files to understand the testing approach.

**Step 2 — Infer the module's full character**

From what you read, determine all of the following. Take notes before writing the doc.

- **Purpose**: What is this module's single responsibility? What business problem does it own?
- **Internal architecture**: How are files/classes/packages organized? What is the flow from entry to output? Name the layers (e.g., handler → service → repository → DB).
- **Coding conventions**: Name every convention you observed. Include: naming style (files, classes, functions, variables, constants), error handling approach, logging conventions, null/error return patterns, whether code is class-based or functional, import ordering, anything that deviates from the rest of the codebase.
- **Key patterns**: Recurring design patterns. For each, name the canonical file where it is demonstrated.
- **Key types/interfaces**: The data structures a contributor must understand. For each: what it represents, where it is defined (file:line if possible).
- **What belongs here**: The specific concerns that are owned by this module. Be concrete.
- **What doesn't belong here**: Anti-patterns, responsibility violations, and where to put things that don't belong.
- **Key dependencies**: Every external library and internal module used here, and why each is used here specifically (not just "it's a utility library").
- **Testing approach**: Test framework, test patterns, what is tested vs mocked vs skipped, how to run tests for this module specifically.
- **Common gotchas**: Anything that surprised you while reading the code. Non-obvious behaviors, things that look wrong but are intentional, known footguns.

**Step 3 — Fill in the template**

Read `templates/module-CLAUDE.md.md` from the plugin directory.

Fill in every `{{PLACEHOLDER}}` with concrete, specific content based on what you actually read.
Do not leave placeholders empty or write generic statements that could apply to any module.

Guidelines for each section:

- `{{MODULE_DESCRIPTION}}`: 3-5 sentences. Start with what the module does, end with what it does NOT do (its boundary).
- `{{MODULE_ARCHITECTURE}}`: Describe the internal file structure and data flow. Include a mini directory tree if it helps. Name the main classes/functions and how they relate.
- `{{CODING_CONVENTIONS}}`: Use a bullet list. Be as specific as possible. Include examples of what the convention looks like in code (brief inline snippets are fine).
- `{{KEY_PATTERNS}}`: One paragraph per pattern. Name the pattern, describe when to use it, and cite the canonical file.
- `{{KEY_TYPES}}`: Table or bullet list. Name, definition location, one-line description.
- `{{WHAT_BELONGS}}` and `{{WHAT_DOES_NOT_BELONG}}`: Concrete bullet lists. "Validation of incoming HTTP request bodies" is good; "validation logic" is too vague.
- `{{KEY_DEPENDENCIES}}`: One bullet per dependency with name, why it's used here, and any known constraints.
- `{{TESTING_APPROACH}}`: Explain the test setup, how to run tests, what tooling to use, and the overall philosophy (unit vs integration vs e2e for this module).
- `{{COMMON_GOTCHAS}}`: Only include things you actually observed as surprising or non-obvious. Leave empty (remove the section) rather than inventing gotchas.
- `{{RELATED_DOCS_EXTRA}}`: Additional links to module-adjacent docs (e.g., a security doc for an auth module).

If you don't have enough information for a section, write a specific TODO: `<!-- TODO: describe testing approach — could not infer from source files -->`. Do not write generic placeholder text.

**Step 4 — Write the file**

Write the filled template to `$ARGUMENTS/CLAUDE.md`.

**Step 5 — Update root CLAUDE.md**

If root `CLAUDE.md` exists and has a "Module Guides" table, add a row for this module:
```
| `$ARGUMENTS/` | [$ARGUMENTS/CLAUDE.md](./$ARGUMENTS/CLAUDE.md) |
```

**Step 6 — Report**

Tell the user:
- What was written and how many lines
- Which sections are fully populated vs need human review
- Any patterns or conventions you were uncertain about and why
