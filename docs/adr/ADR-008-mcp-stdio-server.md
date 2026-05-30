# ADR-008: Hand-rolled, zero-dependency MCP stdio server

## Status
Accepted (2026-05-30).

## Context
ADR-007 built error triage as an offline, deterministic engine and explicitly reserved it
as a **seam** an MCP step could later wrap, so an AI agent running inside Roblox Studio
(via the official, GA-since-2026-03-05 built-in MCP server: `get_console_output`,
`run_code`, `start_stop_play`, …) can call our diagnosis→fix step between reading the
console and applying a fix. This ADR records how we expose that seam.

The Model Context Protocol defines two transports. We need **stdio** (the client spawns
the server as a subprocess and exchanges newline-delimited JSON-RPC 2.0 over stdin/stdout)
— that is the transport MCP clients "SHOULD support whenever possible" and the one Studio
/ Claude / Cursor use for local servers.
([spec: transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports))

A core, *publicly stated* invariant of this project is **zero runtime dependencies**
(K-4 / ADR-005): minimal supply-chain surface, each addition requiring an ADR.

## Decision
Implement a **minimal MCP stdio server by hand**, with no SDK and no runtime dependencies.

The stdio data layer we must speak is small and fully specified: a handshake
(`initialize` → result; `notifications/initialized` → no reply), discovery (`tools/list`),
and execution (`tools/call`), framed as one JSON-RPC object per line, UTF-8, with no
embedded newlines, and stdout reserved exclusively for MCP messages (logs to stderr).
We implement exactly that set; any other method returns JSON-RPC `-32601`.

Structure (thin transport adapter over the existing domain-agnostic core, ADR-001):
- `src/mcp/protocol.ts` — **pure** `handleMessage(msg) => response | null`; the whole
  protocol brain, no I/O, never throws.
- `src/mcp/tools.ts` — the 2-tool catalog (`triage_errors`, `analyze_source`) delegating
  to the already-exported pure functions; JSON-Schema `inputSchema` literals; **hand-written
  argument validation** (no schema library).
- `src/mcp/server.ts` — the only impure file: stdin line-reader → `JSON.parse`
  (→ `-32700` on a bad line) → `handleMessage` → one JSON line to stdout; stderr for logs.
- `bin: roblox-port-doctor-mcp`.

## Alternatives considered
- **Depend on `@modelcontextprotocol/sdk` (Option A).** The official SDK. Rejected: at
  v1.29.0 it pulls **17 runtime dependencies** (express, hono, cors, jose, pkce-challenge,
  zod, ajv, …), almost all to support the HTTP/OAuth transport we do not use. Adopting it
  would break the headline zero-dependency invariant and contradict the README/ADR-005
  story the portfolio is built on — a poor trade to add one thin wrapper.
  (Verified: `npm view @modelcontextprotocol/sdk@1.29.0 dependencies`, 2026-05-30.)
- **Drive Studio live via MCP ourselves.** Already rejected in ADR-007 (non-determinism,
  overlap with first-party tooling). This ADR is about being *callable*, not about owning
  the loop.

## Consequences
- The zero-dependency invariant holds — and is now *stronger* evidence of the design
  discipline the tool advocates (we chose conformance-by-hand over a heavy SDK).
- The protocol brain is a pure function → fully unit-tested (10 cases) with no child
  process or real client (mirrors the determinism of ADR-002/007).
- **Limitations (honest):** we track the MCP stdio spec ourselves and implement only the
  minimal method set; HTTP/SSE transport, OAuth, resources, prompts, sampling, and
  server-initiated notifications / dynamic tool-list changes are out of scope. If a future
  client needs those, revisit Option A behind a build flag rather than in the default build.
