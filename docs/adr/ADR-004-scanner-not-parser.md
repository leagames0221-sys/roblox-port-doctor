# ADR-004: Comment/string-aware scanner, not a full Luau parser

## Status
Accepted.

## Context
Rules need to match patterns in source without firing on text inside strings or
comments (the classic linter false-positive). The fully correct approach is a real Luau
parser/AST. But a parser is a large dependency (or a large amount of code to own), and
the project constraint is **zero runtime dependencies** plus consumer-laptop simplicity.

## Decision
Implement a small stateful **scanner** (`core/scan.ts`) that blanks out comment bodies
and string-literal contents — replacing each stripped character with a space so *column
positions are preserved* — handling line comments, block comments, quoted strings and
long-bracket strings (including multi-line). Rules run over this "code" view. The rare
rule that genuinely wants the raw text (none currently) can read `ctx.raw`.

## Consequences
- Eliminates the biggest false-positive class with ~100 lines and zero dependencies.
- Cannot reason about syntax/data-flow; some rules stay heuristic (documented as such).
- Edge cases a real parser would nail (e.g. a string continued with a trailing
  backslash across lines) are handled conservatively, not perfectly. Accepted for v0.
- Alternative considered: vendor a Luau grammar / parser. Rejected for v0 on the
  dependency and complexity budget; revisit if data-flow rules are needed.
