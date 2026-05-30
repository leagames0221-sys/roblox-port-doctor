# Stage 1 Discovery — MCP server wrapper (prior-art research)

Date: 2026-05-30
Scope: research-only (read-only). No code changed.

## Goal

Expose the deterministic triage seam (`triageErrors()`, already a pure exported
function) so an AI agent running *inside* Roblox Studio can call it over MCP —
turning ADR-007's "an MCP step can later wrap this" from claim into product.

## Findings (primary sources)

### F1 — Roblox MCP is first-party and already shipping
- Roblox maintains `Roblox/studio-rust-mcp-server` and has brought the MCP server
  **natively into Studio** (built-in is now the recommended path; the open-source
  reference implementation remains available).
  Source: https://github.com/Roblox/studio-rust-mcp-server ,
  https://devforum.roblox.com/t/assistant-updates-studio-built-in-mcp-server-and-playtest-automation/4474643
- Relevant Studio-side tools: `run_code`, `get_console_output`, `start_stop_play`,
  `run_script_in_play_mode` (returns structured logs/errors/duration).
- Implication: the live "run → read console → fix → re-run" loop is owned by the
  platform. Our value is the **offline, deterministic error→fix step** that an
  agent can call between reading the console and applying a fix — exactly the seam
  ADR-006/007 reserved. We add an MCP **server** that exposes our triage as a tool;
  any MCP **client** (Claude/Cursor/Studio Assistant) can then call it.

### F2 — Official TypeScript SDK exists, with the expected API shape
- Package: `@modelcontextprotocol/sdk` (latest 1.29.0 at time of research).
- Pattern: `new McpServer({name,version})` → `server.registerTool(name, {description, inputSchema}, handler)`
  → `await server.connect(new StdioServerTransport())`. stdio transport = JSON-RPC
  2.0 over stdin/stdout for locally-spawned servers.
  Source: https://github.com/modelcontextprotocol/typescript-sdk ,
  https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
- Input schemas use a Zod (Standard Schema) object, validated at the tool boundary.

### F3 — ⚠ CONFLICT: the official SDK breaks our zero-dependency invariant
- `npm view @modelcontextprotocol/sdk@1.29.0 dependencies` (verified live) =
  **17 runtime dependencies**: `@hono/node-server, ajv, ajv-formats, content-type,
  cors, cross-spawn, eventsource, eventsource-parser, express, express-rate-limit,
  hono, jose, json-schema-typed, pkce-challenge, raw-body, zod, zod-to-json-schema`.
- This directly contradicts K-4 / ADR-005 (zero runtime dependencies = minimal
  supply-chain surface), which the README and our strong-hire honesty claim depend on.
- Note: those deps (express/hono/cors/jose/pkce/rate-limit) exist mainly to support
  the **HTTP / OAuth** transport. The **stdio** transport we need is JSON-RPC 2.0
  newline-delimited over stdin/stdout — a small, well-specified protocol.

### F4 — The minimal stdio protocol is small and fully specified (verified)
Source: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
+ https://modelcontextprotocol.io/docs/learn/architecture (worked JSON-RPC example).
- **Framing**: newline-delimited JSON-RPC 2.0 over stdin/stdout, UTF-8. Each message
  is exactly one line; messages **MUST NOT** contain embedded newlines (so we
  `JSON.stringify` without pretty-printing — single line by default). Server **MUST NOT**
  write non-MCP text to stdout; logging goes to **stderr**.
- **Lifecycle**: client → `initialize` (request, has id) ; server → result with
  `protocolVersion`, `capabilities:{tools:{}}`, `serverInfo`. Then client →
  `notifications/initialized` (notification, no id → no response).
- **Tool discovery**: client → `tools/list` (id, no params) ; server → `result.tools[]`,
  each `{name, title?, description, inputSchema (JSON Schema object)}`.
- **Tool call**: client → `tools/call` params `{name, arguments}` ; server →
  `result.content[]` e.g. `[{type:"text", text:"..."}]`.
- Verified message shapes are copied above from the official worked example. inputSchema
  on the wire is plain **JSON Schema** (not Zod) — so a hand-rolled server just emits a
  JSON Schema literal; no schema library is required.

Conclusion: a conformant minimal stdio MCP server = a stdin line-reader + a switch over
3 methods + 1 notification, writing one JSON line per response to stdout. This is a few
dozen lines and needs **no runtime dependency**.

## Design fork (for ADR-008)

Two honest options:

- **Option A — depend on `@modelcontextprotocol/sdk`.** Fastest, fully spec-tracked
  by upstream. Cost: pulls 17 transitive runtime deps; breaks the headline
  zero-dependency invariant and the consistency of the README/ADR-005 story.
- **Option B (recommended) — thin, zero-dependency stdio JSON-RPC server.** Implement
  only the minimal MCP method set the stdio transport requires (`initialize`,
  `tools/list`, `tools/call`) over `node:process` stdin/stdout, delegating
  `tools/call` straight to the existing pure `triageErrors()` / `analyze()`. Keeps
  K-4 intact, keeps the wrapper as a thin seam (ADR-001), and is itself the
  "腕の見せ所" (M3): we chose protocol-conformance over a heavy SDK to preserve the
  product's core invariant. Cost/limitation (must be disclosed): we track the MCP
  stdio spec ourselves and support only the minimal method set; advanced transports
  (HTTP/OAuth/streaming) are out of scope.

Recommendation: **Option B**, because the zero-dependency invariant is this tool's
identity and is publicly claimed; importing 17 deps to add one wrapper would
undermine the very thing the portfolio is demonstrating. F4 confirms the minimal
stdio protocol is small enough to implement directly and conformantly.

## Next (pending user OK on the fork)

Stage 2 Requirements (EARS) → Stage 3 Design (file plan: `src/mcp/` thin server +
JSON-RPC framing; reuse `triageErrors`/`analyze`; tests with a fake stdin/stdout)
→ Stage 4 Tasks. Each gate user-approved.
