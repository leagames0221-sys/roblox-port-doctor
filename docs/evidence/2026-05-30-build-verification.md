# Build verification — 2026-05-30

Evidence ledger for roblox-port-doctor v0 (post Spec-Driven rebuild: A security/authority
+ B UE5-port + C error-triage). Verification order: type check → automated tests → CLI
smoke (real Studio not required, ADR-007).

## Environment
- Node.js v24.13.1 (Windows 11). Dev toolchain: TypeScript only (reused via a
  `node_modules` junction to a sibling project; zero new downloads).
- Runtime dependencies: **0** (only `typescript` in devDependencies).

## 1. Type check — PASS
`npm test` runs `tsc && node --test`. Because of `&&`, the test phase only runs if `tsc`
succeeds; the test summary below therefore also confirms the type check passed.
Builds with `"types": []` + hand-declared `src/runtime.d.ts` (ADR-005); no `@types/node`.

## 2. Automated tests — PASS (59 tests, 0 fail)
```
ℹ tests 59
ℹ pass 59
ℹ fail 0
```
Per-file: scan 6, analyze 6, roblox-rules 9, ue5-port-rules 11, fix 4,
parse-error 6, triage 9, pipeline 8.
Flagship (C) confirmed running standalone:
```
node --test tests/unit/triage.test.mjs tests/unit/parse-error.test.mjs
ℹ tests 15  ℹ pass 15  ℹ fail 0
```
Coverage by file:
- `scan.test.mjs` — comment/string-aware scanner.
- `analyze.test.mjs` — engine: default pack, string/comment immunity, sort, unknown-pack
  error, dedup.
- `roblox-rules.test.mjs` — 7 rules each with +/- cases; asserts no `RBX-DEP-*` remain
  (delegated to luau-analyze, ADR-006).
- `ue5-port-rules.test.mjs` — 10 rules incl. off-by-default + replace fixes.
- `fix.test.mjs` — mechanical fix application, advisory collection, stub-LLM fallback.
- `parse-error.test.mjs` — error head / stack frame / timestamp / multi-error split (R7).
- `triage.test.mjs` — all 6 classifiers + unrecognized fallback (R10) + multi-error +
  static cross-reference (R9).
- `pipeline.test.mjs` — end-to-end: static (analyze→fix→render) and triage
  (parse→classify→render text/json) on real-shaped inputs.

## 3. Requirements coverage (Stage 2 EARS → tests)
- R1/R6 analyze + scan; R2 zero-dep (package.json); R3 determinism; R4/R5-DEDUP roblox
  pack (security kept, DEP removed); R5 ue5-port; **R7/R8/R10/R12 triage**; R9 cross-ref;
  R11/R13 LLM optional + stub fallback; R14 no secrets; R15/R16/R17 CLI.

## 4. CLI smoke (reproducible) — PASS
Triage on a real-shaped 2-error console dump (`node dist/cli.js --triage error.log`),
actual captured output:
```
roblox-port-doctor triage:

  1. [nil-index] ★★★  ServerScriptService.PlayerService:7
     error: attempt to index nil with 'leaderstats'
     why:   A value that is `nil` is being indexed to read `.leaderstats`...
     fix:   Guard the parent... or use `:WaitForChild("leaderstats")`...

  2. [infinite-loop] ★★★  ServerScriptService.Loop:18
     error: Script timeout: exhausted allowed execution time
     why:   The script ran too long without yielding (line 18)...
     fix:   Add a `task.wait()` inside the loop body...

  2 error(s): 2 recognized, 0 unrecognized
```
Exit code 1 (errors present). Static analysis + `--fix` (rewrites `!=`→`~=`,
`nullptr`→`nil`, `&&`→`and`) are covered by the end-to-end pipeline test.

## Status
v0 rebuilt per Stage 1–4 design and verified (type check + 59 tests, 0 fail). Inventory:
roblox 7 rules, ue5-port 10 rules, triage 6 classifiers. README + ADR-001..007 + LICENSE.
Follow-up (not done): git init / publish, demo asset, MCP-server wrapper around the triage
seam, live `--explain` probe against Workers AI, strong-hire 18+M1-M5 公開前 apply.
