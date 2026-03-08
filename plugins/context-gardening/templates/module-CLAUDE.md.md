# {{MODULE_NAME}} Module Guide

<!-- garden-managed: auto -->
<!-- last-reviewed: {{DATE}} -->

> Local style guide for the `{{MODULE_NAME}}` module.
> Claude Code automatically loads this file when it reads files in this directory.
> The root `CLAUDE.md` is intentionally brief. This file should be thorough.

## Purpose

{{MODULE_DESCRIPTION}}

## Architecture Within This Module

<!-- How is this module internally organized? Describe the file/class/package structure.
     What is the entry point? What are the main layers (e.g., handler → service → repository)?
     A reader should be able to orient themselves without reading source files first. -->

{{MODULE_ARCHITECTURE}}

## Coding Conventions

<!-- Be specific. "Use X, not Y" is more useful than "follow clean code principles."
     List as many conventions as you actually observed — aim for completeness, not brevity. -->

{{CODING_CONVENTIONS}}

## Key Patterns

<!-- Describe recurring patterns with enough detail that a contributor can replicate them
     without reading the implementation. Include representative code snippets or file references.
     E.g., "All DB queries use the Repository class (src/auth/repository.ts). Never use raw SQL.
     See UserRepository.findByEmail for the canonical example." -->

{{KEY_PATTERNS}}

## Key Types and Interfaces

<!-- List the primary types, interfaces, structs, or models that agents and contributors
     must understand to work in this module. Name the file and line reference where each is defined.
     Include a one-line description of what each represents. -->

{{KEY_TYPES}}

## What Belongs Here

<!-- What concerns, responsibilities, and code types should live in this module?
     Be concrete: "input validation for auth routes", not "validation logic". -->

{{WHAT_BELONGS}}

## What Does Not Belong Here

<!-- Anti-patterns and boundary violations. Name specific things that have been
     (or are tempting to) put here incorrectly, and where they should go instead. -->

{{WHAT_DOES_NOT_BELONG}}

## Key Dependencies

<!-- External libraries and internal modules this module depends on.
     For each: why it is used here, any version constraints, and any known gotchas. -->

{{KEY_DEPENDENCIES}}

## Testing Approach

<!-- Module-specific testing patterns. What to test, what not to test, what tools to use.
     E.g., "Integration tests against a real test DB (never mocks). Run with: npm test -- auth.
     Unit tests cover validators only. Factories are in tests/factories/user.ts." -->

{{TESTING_APPROACH}}

## Common Gotchas

<!-- Surprising behaviors, footguns, or non-obvious rules that have burned contributors before.
     Every item here should save someone at least 30 minutes. -->

{{COMMON_GOTCHAS}}

## Related Docs

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/DESIGN.md](../../docs/DESIGN.md)
{{RELATED_DOCS_EXTRA}}
