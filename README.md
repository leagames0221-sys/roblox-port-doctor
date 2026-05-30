# roblox-port-doctor

[![CI](https://github.com/leagames0221-sys/roblox-port-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/leagames0221-sys/roblox-port-doctor/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**A focused debug assistant for Luau / Roblox** — it covers the gap the official tooling
leaves open: **server-authority & security**, **UE5→Luau port pitfalls**, and turning a
**runtime error into a diagnosis + fix**. It does *not* try to be another general Luau
linter — [luau-analyze](https://luau.org/lint) and
[selene](https://kampfkarren.github.io/selene/) already do that well, and this tool is
designed to sit on top of them (see [ADR-006](docs/adr/ADR-006-positioning-vs-official-linters.md)).

It is the **downstream sibling** of
[`roblox-spec-compass`](https://github.com/leagames0221-sys/roblox-spec-compass)
(natural language → design + effort): *compass* plans the work, *doctor* debugs it.

## What it does

**1. Static analysis — security / authority / reliability (`roblox` pack, default):**

![Static analysis on a buggy server script](docs/assets/demo-static.png)

*(real CLI output — regenerate with `python scripts/screenshot_demo.py`)*

**2. UE5→Luau port pitfalls (`ue5-port` pack, opt-in):** `&&`/`||`/`!=`/`nullptr`,
0-based indexing, leftover `UE_LOG`/`std::`, client-side authority. Mechanical ones are
auto-fixable with `--fix`.

**3. Runtime error triage (the flagship) — turn a console dump into a fix:**

![Runtime error triage producing diagnosis and fix](docs/assets/demo-triage.png)

It parses the exact text Roblox's console (and the official MCP `get_console_output`
tool) emits, classifies each error deterministically, and proposes a fix — or says
`unrecognized` rather than guessing.

## Why this shape

AI debug *agents* now run **inside** Roblox Studio via the official MCP server (GA
2026-03-05: `start_stop_play` / `get_console_output` / …) — so the live "run → read →
fix → re-run" loop is first-party. Competing with it, or reimplementing the 28 lints
luau-analyze already ships, would be wasted work. Instead this tool does the
**deterministic, offline, zero-cost** part the platform *doesn't*: security/authority
rules, port pitfalls, and error→fix triage — and exposes triage as a clean **seam** an
MCP step can wrap (see [ADR-007](docs/adr/ADR-007-offline-triage-mcp-seam.md)). That
wrapper now ships: a zero-dependency **MCP stdio server** (see *Use it from an AI agent*
below and [ADR-008](docs/adr/ADR-008-mcp-stdio-server.md)).

## How this came together

- **Motivation.** The first prototype tried to be a general Luau linter. A prior-art pass
  (May 2026) showed that space is already well served — `luau-analyze` ships 28 lints and
  `selene` is mature — so a clone would have been wasted work, and worse, it would compete
  with first-party tooling instead of helping.
- **Approach.** I deliberately *narrowed* scope to the gaps those tools leave open
  (security/authority, UE5→Luau ports, runtime error→fix triage), built a domain-agnostic
  engine so each gap is a small injected pack, and kept the LLM strictly optional so the
  product is reproducible and free by default. Every design fork is recorded in an ADR.
- **Result & what I learned.** v0 ships 7 + 10 rules and 6 deterministic error
  classifiers, **59 tests green in CI, zero runtime dependencies**. The sharpest lesson
  was a discipline one: *subtracting* the overlapping rules (9→7) made the tool stronger
  than adding more would have — positioning beats feature count. Recall is intentionally
  bounded (see Limitations) rather than over-claimed.

## Install & usage

Requires Node.js ≥ 20.

```bash
npm install      # dev-only: TypeScript. Zero runtime dependencies.
npm run build    # tsc -> dist/
node dist/cli.js path/to/script.luau
```

| command / flag | effect |
|---|---|
| `<file.lua>` | static analysis (default `roblox` pack) |
| `--packs roblox,ue5-port` | choose rule packs |
| `--json` | machine-readable output |
| `--fix` | print the source with mechanical fixes applied |
| `--explain` | add LLM-grounded prose (optional, see below) |
| `--triage <file>` / stdin | triage a console error dump into diagnoses + fixes |
| `--src <file>` | (with `--triage`) cross-reference static findings on the errored line |

Programmatic:

```ts
import { analyze, applyDeterministicFixes, triageErrors } from "roblox-port-doctor";
const findings = analyze(source, { packs: ["roblox", "ue5-port"] });
const diagnoses = triageErrors(consoleOutput, { source, findings });
```

## Use it from an AI agent (MCP)

An AI agent running inside Roblox Studio (via the official built-in MCP server) — or any
MCP client like Claude or Cursor — can call the triage and analysis engine directly. The
server speaks the MCP **stdio** transport and is **hand-rolled with zero runtime
dependencies** (we deliberately did not pull the official SDK's 17 transitive deps — see
[ADR-008](docs/adr/ADR-008-mcp-stdio-server.md)).

```bash
npm run build
node dist/mcp/server.js     # or, once installed: roblox-port-doctor-mcp
```

Register it with an MCP client (example config):

```json
{
  "mcpServers": {
    "roblox-port-doctor": { "command": "node", "args": ["dist/mcp/server.js"] }
  }
}
```

Exposed tools:

| tool | input | does |
|---|---|---|
| `triage_errors` | `consoleOutput` (required), `source?`, `packs?` | turn a console error dump (e.g. from the official `get_console_output`) into diagnoses + fixes |
| `analyze_source` | `source` (required), `packs?` | static analysis over Luau source text |

Everything stays offline and deterministic — the server is a pure pass-through to the same
engine the CLI uses; no network, no filesystem writes, no LLM call.

## Rule & classifier inventory (v0)

- **`roblox` pack (7)** — RBX-PERF-002 (Instance.new Parent), RBX-NIL-001 (FindFirstChild
  chain), RBX-SEC-001 (loadstring), RBX-SEC-002 (asset-id require), RBX-SEC-003
  (RemoteEvent client trust), RBX-DS-001 (DataStore pcall), RBX-PERF-001 (freeze loop).
  *Bare `wait`/`spawn` deprecation is intentionally delegated to luau-analyze's
  DeprecatedGlobal — ADR-006.*
- **`ue5-port` pack (10, opt-in)** — `&&`/`||`/`!=`, null literals, `++`, C++ tokens,
  0-based `[0]` / `for i=0`, client authority, trailing `;`.
- **triage classifiers (6)** — nil-index, call-nil, nil-arithmetic, invalid-member,
  infinite-loop, datastore; unknown → `unrecognized`.

## Design

```
src/
  core/            domain-agnostic engine (knows nothing about Roblox)
    scan.ts        comment/string-aware scanner (no false positives in strings/comments)
    analyze.ts     run rules over the stripped source, line by line
    parse-error.ts parse Roblox console error text → ParsedError[]
    triage.ts      run classifiers over parsed errors → Diagnosis[]
    fix.ts         apply mechanical fixes; optional LLM explanation
    report.ts      text / JSON rendering (findings + diagnoses)
    llm.ts         pluggable LLM provider (free default, stub fallback)
    types.ts       Rule / Finding / Pack / Diagnosis / ErrorClassifier contracts
  packs/
    roblox/        security / authority / reliability rules (default)
    ue5-port/      C++/Blueprint → Luau migration pitfalls (opt-in)
    triage/        deterministic runtime-error classifiers (the flagship)
```

Adding a domain = adding a `Pack` (or classifier); the core engine is untouched. Decision
records in [`docs/adr/`](docs/adr/). The two-layer shape (generic core + domain pack) is
shared with `roblox-spec-compass`.

## Four standing constraints

1. **Free** — no paid service required; the LLM layer is optional.
2. **No credit card** — default provider (Cloudflare Workers AI) and the local option
   (Ollama) both work without card registration; with no provider, the tool is fully
   deterministic.
3. **Local-capable** — analysis and triage are 100% local/offline; only `--explain` makes
   a network call, and that can point at a local Ollama.
4. **Security-first** — zero runtime dependencies (no supply-chain surface); no secrets in
   the repo (LLM credentials read from env); the rules are security-weighted.

| `LLM_PROVIDER` | needs | notes |
|---|---|---|
| `workers-ai` (default) | `CF_ACCOUNT_ID`, `CF_API_TOKEN` | Cloudflare free tier, no card |
| `ollama` | local Ollama | fully offline / private |
| `anthropic` | `ANTHROPIC_API_KEY` | for a paid engagement |
| _none set_ | — | falls back to deterministic messages |

## Verification

`npm test` runs `tsc && node --test`: type-check + the full suite (scan, analyze, both
rule packs, fix, error parsing, triage, and an end-to-end pipeline). Evidence:
[docs/evidence/2026-05-30-build-verification.md](docs/evidence/2026-05-30-build-verification.md).

## Limitations (honest)

- **Scanner, not a parser**: rules are regex/line based over a comment/string-aware view.
  Robust and dependency-free, but no cross-function data-flow reasoning; some rules are
  advisory heuristics, not proofs.
- **Not a general linter** — by design (ADR-006). Run luau-analyze/selene for general
  correctness/style; this adds the security + port + triage layer.
- **Triage recall is bounded** by its 6 classifiers; unknown errors are reported as
  `unrecognized` rather than guessed.
- **MCP server is stdio-only and minimal** — it implements the minimal MCP stdio method
  set by hand (initialize / tools/list / tools/call); HTTP/SSE transport, OAuth, resources,
  prompts and sampling are out of scope by design (ADR-008). It does not drive Studio's
  live run-loop — that is first-party (ADR-007); this tool is the deterministic step an
  agent calls *within* that loop.

## License

MIT — see [LICENSE](LICENSE).
