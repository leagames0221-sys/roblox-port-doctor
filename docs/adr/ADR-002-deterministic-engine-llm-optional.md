# ADR-002: Deterministic engine first; the LLM is optional grounding

## Status
Accepted.

## Context
"AI debug automation" could mean *send the file to an LLM and ask for bugs*. That is
non-deterministic (different answers each run), costs tokens per file, needs network +
credentials, and can hallucinate issues. But the bulk of real Roblox bugs are a known,
finite catalogue (deprecated `wait`, unguarded DataStore calls, client-trusting
remotes, busy loops, port operators). Those are detectable deterministically.

## Decision
Make the **deterministic rule engine the product**. It runs with no LLM, no network and
no credentials, and produces identical output every run. The LLM is a strictly
**optional** layer (`--explain`) that only *explains* findings the rules already made;
it never invents findings. With no provider configured, the engine transparently falls
back to the rules' own messages (a `StubLlmClient` returning `""`).

## Consequences
- Reproducible, fast, free, offline by default — and easy to put in CI.
- The expensive, non-deterministic AI agent is reserved for the genuinely hard cases the
  rules cannot reach (cross-function data flow), instead of being spent on the easy 80%.
- The rules require manual curation; the tool's recall is bounded by its rule set, not by
  a model. Accepted, and made honest in the README's limitations.
- Alternative considered: LLM-as-detector. Rejected for determinism, cost and
  hallucination reasons above; kept only as the explanation layer.
