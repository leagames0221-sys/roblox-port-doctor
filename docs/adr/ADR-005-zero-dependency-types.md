# ADR-005: Hand-declared ambient types instead of `@types/node`

## Status
Accepted.

## Context
The project ships **zero runtime dependencies** and keeps build-time deps minimal
(TypeScript only). The CLI and LLM client touch a small set of Node/Fetch globals
(`process`, `console`, `fetch`, and `fs.readFileSync`). The conventional way to type
these is the `@types/node` package, but pulling it in for ~5 symbols adds a sizeable
dev dependency, and in this environment the shared toolchain does not already provide it.

## Decision
Set `"types": []` in `tsconfig` (so no ambient `@types/*` are auto-included) and declare
exactly the handful of globals used in a single `src/runtime.d.ts`. Runtime behaviour is
unchanged; these are compile-time-only shims.

## Consequences
- Build and type-check succeed with TypeScript as the only build dependency; runtime
  deps remain zero, satisfying the supply-chain constraint.
- If the surface of Node APIs used grows, the shim must be extended (or `@types/node`
  adopted). The boundary is small and explicit, so this is cheap to revisit.
- Trade-off: a reviewer expecting `@types/node` will see a custom shim instead; the
  rationale lives here so the choice is legible rather than surprising.
- Alternative considered: add `@types/node` as a devDependency. Reasonable, and the right
  move if Node usage broadens; deferred to keep the dependency footprint minimal for v0.
