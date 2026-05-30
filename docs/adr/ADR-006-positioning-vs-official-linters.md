# ADR-006: Positioning — complement, don't compete with official linters

## Status
Accepted (2026-05-30, after prior-art research).

## Context
Prior-art research (2026.5) found the Luau/Roblox static-analysis space is already
well served:
- **luau-analyze** (official) ships **28 built-in lint warnings** — UnknownGlobal,
  DeprecatedGlobal (covers bare `wait`/`spawn`/`delay`), LocalShadow, LocalUnused,
  UnreachableCode, DeprecatedApi, ForRange, TableOperations, … — AST-based, configured
  via `.luaurc`/`--!`. [luau.org/lint](https://luau.org/lint)
- **selene** (Rust, full-moon AST) provides correctness/suspicious/style/complexity/
  performance/**roblox** lints with allow/warn/deny and a generated Roblox std library.
  [kampfkarren.github.io/selene](https://kampfkarren.github.io/selene/)

Re-implementing those general lints would be wasted effort competing against mature,
first-party tools — and our own v0 prototype had already drifted into that overlap
(`RBX-DEP-001/002` duplicated DeprecatedGlobal).

## Decision
Position roblox-port-doctor as a **complement**, not a competitor. It deliberately does
**not** re-implement general correctness/style lints. It targets the high-signal gap the
official tooling leaves open:
- **A. Security / server-authority / reliability** — RemoteEvent client-trust, loadstring,
  numeric-asset `require`, DataStore-without-pcall, freeze loops. (Not in luau-analyze's
  28 warnings.)
- **B. UE5→Luau port pitfalls** — a niche no general linter covers.
- **C. Runtime error→fix triage** — see ADR-007.

The overlapping prototype rules (`RBX-DEP-001/002`) were removed; `roblox` pack went
9→7 rules.

## Consequences
- Clear differentiation; no wasted reimplementation.
- Users are expected to run luau-analyze/selene for general lint; this tool adds the
  security + port + triage layer on top. Documented in the README.
- Recall for general bugs is intentionally out of scope — honest limitation.
- Alternative considered: a full general-purpose Luau linter. Rejected — it loses to
  first-party tools and duplicates them.
