# ADR-007: Error triage is offline & deterministic, with a seam for the official MCP loop

## Status
Accepted (2026-05-30).

## Context
The flagship value (C) is turning a runtime error into a diagnosis + fix — the heart of
"AI debug automation". Roblox now ships, GA since 2026-03-05, a
**Studio built-in MCP server** with playtest automation: `start_stop_play`,
`get_console_output`, `user_mouse_input`, `user_keyboard_input`, `character_navigation`
— enabling an autonomous "run → read output → fix → re-run" loop driven by an AI agent.
[devforum 4474643](https://devforum.roblox.com/t/assistant-updates-studio-built-in-mcp-server-and-playtest-automation/4474643)

So the *runtime loop itself is owned by Roblox*. Building another live loop would compete
with first-party tooling and force every test to depend on a running Studio instance —
non-deterministic, and real-machine smoke testing is a last resort, not a default.

## Decision
Implement triage as an **offline, deterministic** stage:
- Input is **plain error text** — exactly what `get_console_output` emits (also a file or
  stdin). `parseErrorLog` splits multi-error dumps; `parseError` structures each.
- A registry of pure `ErrorClassifier`s maps an error to {class, diagnosis, fix,
  confidence}. Unknown errors return `unrecognized` rather than a guess (no hallucination).
- No Studio, no network, no LLM required; the optional `--explain` LLM layer only adds
  prose.

This makes triage fully unit-testable and frames it as a **seam**: the same engine can
later be wrapped as an MCP step that consumes `get_console_output` and proposes the fix
inside Roblox's official loop, rather than reinventing the loop.

## Consequences
- Triage is reproducible, fast, free, offline — and CI-friendly.
- We ride the official MCP loop instead of competing with it; an MCP-server wrapper is a
  clean follow-up, not a v0 dependency.
- Triage recall is bounded by the classifier set (6 classes in v0); honest limitation.
- Alternative considered: drive Studio live via MCP now. Rejected for non-determinism,
  test-impossibility, and overlap with first-party tooling.
