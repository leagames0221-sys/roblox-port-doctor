# MCP stdio Wrapper — Build & Test Verification — 2026-05-30

roblox-port-doctor — MCP server wrapper (Phase 1.5, ADR-008).

## Command
`npm test` (= `tsc && node --test`, argument-free auto-discovery)

## Result
**73 tests, 73 pass, 0 fail.** (was 59; +14 from the new MCP suite.)

## Post-implementation audit fix (2026-05-30)
An objective edge-case audit found one real protocol bug: a JSON-RPC **notification**
(a message with no `id`) using a method other than `notifications/initialized` — e.g. the
MCP-standard `notifications/cancelled` — wrongly received a `-32601` error reply. JSON-RPC
forbids responding to notifications. Fixed: `handleMessage` now returns null for **any**
message lacking an `id`, regardless of method; unknown methods that DO carry an id still
return `-32601`. Added regression tests (notification-no-reply, unknown-with-id → -32601,
id:0 preserved). Other audited edges were already correct: id `0` preserved (not coerced
to null), `tools/call` with no params → in-band isError, empty `consoleOutput` → isError,
CRLF input parsed, stdout carries only single-line JSON.

## New / changed
- `src/mcp/protocol.ts` — pure `handleMessage` (initialize / notifications/initialized /
  tools/list / tools/call / -32601). No I/O, never throws.
- `src/mcp/tools.ts` — `triage_errors`, `analyze_source`; JSON-Schema inputSchema;
  hand-written validation (no schema library → zero runtime deps preserved).
- `src/mcp/server.ts` — stdio shell: newline-delimited JSON-RPC over stdin/stdout, logs to
  stderr, -32700 on bad JSON line.
- `tests/unit/mcp.test.mjs` — 10 cases (R3–R11).
- `package.json` bin: `roblox-port-doctor-mcp -> ./dist/mcp/server.js`.

## Manual smoke (real stdio, not just unit tests)
Piped a session — initialize, notifications/initialized, tools/list, tools/call
triage_errors (nil-index dump), a malformed line, and an unknown method — into
`node dist/mcp/server.js`:
- stdout: one valid single-line JSON-RPC object per response; notifications produced no
  line; bad line → `-32700` (id null); unknown method → `-32601`. A line-by-line JSON
  validator confirmed every stdout line parses and contains no raw embedded newline
  (triage text's newlines are `\n`-escaped inside the JSON string, per spec).
- stderr: only the startup banner (stdout carried MCP messages exclusively, R2).

## Dependency invariant
`package.json` dependencies still empty (devDependencies: typescript only). The MCP server
adds no runtime dependency (ADR-008, Option B).

## Δ from previous
Adds the MCP stdio server; engine and rule/classifier behavior unchanged.
