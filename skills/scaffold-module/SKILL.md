---
description: Generate a CLAUDE.md stub for a specific source module directory. Reads the module's source files to infer purpose, patterns, and conventions, then writes a filled-in template. Claude Code natively lazy-loads nested CLAUDE.md files when it navigates into a directory. Use when a module has grown large enough to warrant its own local style guide, or when /status reports a module is missing CLAUDE.md. Pass the module path as the argument.
---

You are scaffolding a CLAUDE.md for the module at: "$ARGUMENTS"

If $ARGUMENTS is empty, ask the user: "Which module directory should I scaffold? (e.g., src/auth/)"

**Step 1 — Read the module**

```bash
ls "$ARGUMENTS"
```

Read 5-10 source files from the directory (prefer entry points, main files, index files, and files with descriptive names). Skip test files and generated files.

**Step 2 — Infer the module's character**

From what you read, determine:
- **Purpose**: What does this module do? What business problem does it solve?
- **Coding conventions**: What patterns repeat? (class-based vs functional, error handling style, naming conventions)
- **Patterns used**: Recurring patterns like repository pattern, service objects, middleware chain, etc.
- **What belongs here**: What types of concerns live here?
- **What doesn't belong here**: What have you seen excluded? What would be wrong to add?
- **Key dependencies**: What external libraries or internal modules does this depend on, and why?
- **Testing approach**: How are things tested in this module?

**Step 3 — Fill in the template**

Read `templates/module-CLAUDE.md.md` from the plugin directory.

Fill in all `{{PLACEHOLDER}}` values based on what you found:
- `{{MODULE_NAME}}` → human-readable name for the module
- `{{DATE}}` → today's date YYYY-MM-DD
- `{{MODULE_DESCRIPTION}}` → 1-2 sentence purpose statement
- `{{CONVENTION_1/2/3}}` → specific coding conventions you observed
- Fill in all section bodies with concrete, specific content based on what you actually read

Do not leave any `{{...}}` placeholders unfilled. If you don't have enough information for a section, write a clear placeholder note like `<!-- TODO: describe testing approach -->`.

**Step 4 — Write the file**

Write the filled template to `$ARGUMENTS/CLAUDE.md`.

**Step 5 — Update root CLAUDE.md**

If root `CLAUDE.md` exists and has a "Module Guides" table, add a row for this module:
```
| `$ARGUMENTS/` | [$ARGUMENTS/CLAUDE.md](./$ARGUMENTS/CLAUDE.md) |
```

**Step 6 — Report**

Tell the user what was written and point out any sections that need human review (things you couldn't confidently infer from reading the source files).
