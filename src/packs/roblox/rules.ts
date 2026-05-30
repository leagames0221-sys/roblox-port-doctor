/**
 * Roblox / Luau security, authority & reliability rules — the DEFAULT pack.
 *
 * SCOPE (see ADR-006): this pack deliberately does NOT re-implement the general
 * correctness/style lints that the official `luau-analyze` already ships (28
 * built-in warnings: DeprecatedGlobal, LocalUnused, LocalShadow, UnknownGlobal,
 * UnreachableCode, …). Re-implementing those would be wasted, losing work
 * against a mature first-party tool. Instead this pack targets the HIGH-SIGNAL
 * gap the official linter leaves open: server-authority / security and runtime
 * reliability. The core engine knows nothing of this file. See ADR-004.
 *
 * NOTE: bare `wait()` / `spawn()` / `delay()` deprecation is intentionally NOT
 * here — it duplicates official DeprecatedGlobal (luau.org/lint). Use
 * luau-analyze for that class; this pack stays focused on what it doesn't cover.
 */

import type { Rule, RuleContext, RuleHit } from "../../core/types.js";

const PACK = "roblox";

/** Look at the current + previous non-blank stripped line. */
function prevCode(ctx: RuleContext): string {
  for (let i = ctx.index - 1; i >= 0; i--) {
    if (ctx.codeLines[i].trim()) return ctx.codeLines[i];
  }
  return "";
}

export const ROBLOX_RULES: Rule[] = [
  {
    id: "RBX-PERF-002",
    pack: PACK,
    area: "performance",
    severity: "warning",
    message:
      "Passing Parent to Instance.new() is a known performance antipattern.",
    detect(ctx): RuleHit | null {
      const m = /Instance\.new\s*\(\s*["'][^"']+["']\s*,/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Create the instance, set its properties, then assign .Parent last (reduces replication churn).",
        },
      };
    },
  },
  {
    id: "RBX-NIL-001",
    pack: PACK,
    area: "runtime",
    severity: "warning",
    message:
      "Indexing a FindFirstChild result without a nil check can error if the child is absent.",
    detect(ctx): RuleHit | null {
      const m = /FindFirstChild\s*\(\s*["'][^"']*["']\s*\)\s*[.:]/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Guard the result (`local x = parent:FindFirstChild(...); if x then ... end`) or use WaitForChild for objects that must exist.",
        },
      };
    },
  },
  {
    id: "RBX-SEC-001",
    pack: PACK,
    area: "security",
    severity: "security",
    message: "loadstring executes arbitrary code at runtime — a remote-code-execution risk.",
    detect(ctx): RuleHit | null {
      const m = /(?<![.:\w])loadstring\s*\(/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Avoid loadstring in shipped games; if unavoidable, never feed it client- or HTTP-sourced strings.",
        },
      };
    },
  },
  {
    id: "RBX-SEC-002",
    pack: PACK,
    area: "security",
    severity: "security",
    message:
      "require() by numeric asset id loads remote, mutable code — a supply-chain risk.",
    detect(ctx): RuleHit | null {
      const m = /require\s*\(\s*\d{3,}\s*\)/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Prefer requiring a ModuleScript by reference; a numeric id can be updated by its owner after you ship.",
        },
      };
    },
  },
  {
    id: "RBX-SEC-003",
    pack: PACK,
    area: "security",
    severity: "security",
    message:
      "RemoteEvent/RemoteFunction server handler: validate and sanitize every client argument.",
    detect(ctx): RuleHit | null {
      const m = /\.(OnServerEvent|OnServerInvoke)\b/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Never trust the client: check types, ranges and ownership of every parameter before acting (server-authority).",
        },
      };
    },
  },
  {
    id: "RBX-DS-001",
    pack: PACK,
    area: "reliability",
    severity: "warning",
    message: "DataStore *Async call should be wrapped in pcall (it can throw).",
    detect(ctx): RuleHit | null {
      const m = /:(Get|Set|Update|Increment|Remove)Async\s*\(/.exec(ctx.code);
      if (!m) return null;
      // Already inside / next to a pcall? Then it's fine.
      if (/\bpcall\b/.test(ctx.code) || /\bpcall\b/.test(prevCode(ctx)))
        return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Wrap the call: `local ok, res = pcall(function() return store:GetAsync(key) end)` and retry on failure.",
        },
      };
    },
  },
  {
    id: "RBX-PERF-001",
    pack: PACK,
    area: "performance",
    severity: "error",
    message:
      "`while true do` loop with no yield will freeze the script (and Studio).",
    detect(ctx): RuleHit | null {
      const m = /while\s+true\s+do\b/.exec(ctx.code);
      if (!m) return null;
      // Scan the loop body (up to its matching `end`, capped at 40 lines) for a yield.
      let depth = 1;
      for (let i = ctx.index + 1; i < ctx.codeLines.length && i <= ctx.index + 40; i++) {
        const l = ctx.codeLines[i];
        if (/\b(do|then|function)\b/.test(l)) depth += (l.match(/\b(do|then|function)\b/g) || []).length;
        if (/\bend\b/.test(l)) depth -= (l.match(/\bend\b/g) || []).length;
        if (/task\.wait|(?<![.:\w])wait\s*\(|:Wait\s*\(|RunService|:Connect\s*\(/.test(l)) {
          return null; // has a yield/event — fine
        }
        if (depth <= 0) break;
      }
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Add a task.wait() inside the loop, or drive the work from a RunService event instead of a busy loop.",
        },
      };
    },
  },
];
