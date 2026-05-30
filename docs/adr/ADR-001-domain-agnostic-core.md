# ADR-001: Domain-agnostic core with pack-injected rules

## Status
Accepted.

## Context
The tool must lint Luau/Roblox code, but the brief also explicitly covers a second
audience: code ported from UE5/C++. Those are two different rule sets that will keep
growing, and more domains are plausible (e.g. a Rojo/Luau-standalone profile). If
Roblox knowledge is hard-wired into the engine, every new domain forces edits to the
engine and risks regressions across all of them.

The sibling project `roblox-spec-compass` already proved a two-layer shape (a
domain-agnostic `core/` plus pluggable domain `packs/`) works well for this kind of
tool, so there is decomposed prior art to reuse.

## Decision
Split the system into a **domain-agnostic core** (`src/core/`) that knows only the
abstract `Rule` / `Finding` / `Pack` contracts and how to run rules over source, and
**packs** (`src/packs/<domain>/`) that contain all domain knowledge. The core never
imports a pack; packs are registered in one registry and resolved by name.

## Consequences
- Adding a domain is additive: write a `Pack`, register it. The engine is untouched.
- The core is trivially testable in isolation against synthetic rules.
- Slight indirection cost: a rule cannot reach into engine internals, only the
  `RuleContext` it is handed. Accepted — it keeps the boundary clean.
- Alternative considered: one flat rule list with `if domain === …` branches. Rejected —
  it collapses the boundary and makes the engine grow with every domain.
