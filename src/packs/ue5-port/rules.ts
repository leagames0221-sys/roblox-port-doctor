/**
 * UE5 / C++ -> Luau PORT pitfalls — OPTIONAL pack.
 *
 * These catch the residue of a C++ / Blueprint mental model surviving into
 * Luau: 0-based indexing, C-style operators, leftover C++ tokens, and the
 * single-player -> client/server authority gap. Useful when migrating UE5
 * logic to Roblox, but off by default because most Roblox projects are
 * self-contained.
 * See ADR-004.
 */

import type { Rule, RuleHit } from "../../core/types.js";

const PACK = "ue5-port";

export const UE5_PORT_RULES: Rule[] = [
  {
    id: "UE5-OP-001",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "`&&` is not valid Luau; use `and`.",
    detect(ctx): RuleHit | null {
      const m = /&&/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: { kind: "replace", original: "&&", replacement: "and", note: "C++/JS `&&` -> Luau `and`." },
      };
    },
  },
  {
    id: "UE5-OP-002",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "`||` is not valid Luau; use `or`.",
    detect(ctx): RuleHit | null {
      const m = /\|\|/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: { kind: "replace", original: "||", replacement: "or", note: "C++/JS `||` -> Luau `or`." },
      };
    },
  },
  {
    id: "UE5-OP-003",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "`!=` is not valid Luau; use `~=`.",
    detect(ctx): RuleHit | null {
      const m = /!=/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: { kind: "replace", original: "!=", replacement: "~=", note: "C++/JS `!=` -> Luau `~=`." },
      };
    },
  },
  {
    id: "UE5-NULL-001",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "C++/JS null literal; Luau uses `nil`.",
    detect(ctx): RuleHit | null {
      const m = /(?<![.\w])(nullptr|NULL|null)(?![.\w])/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        message: `\`${m[1]}\` is not valid Luau; use \`nil\`.`,
        fix: { kind: "replace", original: m[1], replacement: "nil", note: `${m[1]} -> nil.` },
      };
    },
  },
  {
    id: "UE5-INC-001",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "Luau has no `++` operator; use `x += 1` or `x = x + 1`.",
    detect(ctx): RuleHit | null {
      const m = /\+\+/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Replace `i++` with `i += 1` (Luau supports compound assignment but not increment/decrement).",
        },
      };
    },
  },
  {
    id: "UE5-CPP-001",
    pack: PACK,
    area: "syntax",
    severity: "error",
    message: "C++/Unreal token left in ported code — not valid Luau.",
    detect(ctx): RuleHit | null {
      const m =
        /(?<![.\w])(std::|static_cast|reinterpret_cast|dynamic_cast|FString|UE_LOG|#include|printf)/.exec(
          ctx.code,
        );
      if (!m) return null;
      return {
        column: m.index + 1,
        message: `\`${m[1]}\` is a C++/Unreal construct with no Luau equivalent.`,
        fix: {
          kind: "advisory",
          note: "Rewrite using Luau idioms (e.g. UE_LOG/printf -> print/warn, FString -> plain string, casts are unnecessary in a dynamic language).",
        },
      };
    },
  },
  {
    id: "UE5-IDX-001",
    pack: PACK,
    area: "logic",
    severity: "warning",
    message:
      "Literal `[0]` index — Luau tables are 1-based, so this is usually an off-by-one port bug.",
    detect(ctx): RuleHit | null {
      const m = /\[\s*0\s*\]/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Roblox/Luau arrays start at index 1; the first element is `t[1]`. Only `[0]` deliberately as a dictionary key is intentional.",
        },
      };
    },
  },
  {
    id: "UE5-IDX-002",
    pack: PACK,
    area: "logic",
    severity: "info",
    message:
      "C-style `for i = 0, ...` loop — Luau arrays are 1-based; verify the bounds.",
    detect(ctx): RuleHit | null {
      const m = /for\s+\w+\s*=\s*0\s*,/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "For array iteration prefer `for i = 1, #t` or `for i, v in ipairs(t)`.",
        },
      };
    },
  },
  {
    id: "UE5-AUTH-001",
    pack: PACK,
    area: "security",
    severity: "security",
    message:
      "Authoritative state mutated on the client — UE5 single-player has no client/server split, Roblox does.",
    detect(ctx): RuleHit | null {
      const m =
        /LocalPlayer[\s\S]*?(leaderstats|Cash|Coins|Gold|Gems|Health|Inventory)/i.exec(
          ctx.code,
        );
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: {
          kind: "advisory",
          note: "Move currency/health/inventory logic to a Script on the server; the client may request changes via a RemoteEvent but must never be trusted to make them.",
        },
      };
    },
  },
  {
    id: "UE5-SEMI-001",
    pack: PACK,
    area: "style",
    severity: "info",
    message: "Trailing semicolon — a C/C++ habit; semicolons are optional and non-idiomatic in Luau.",
    detect(ctx): RuleHit | null {
      const m = /;\s*$/.exec(ctx.code);
      if (!m) return null;
      return {
        column: m.index + 1,
        fix: { kind: "advisory", note: "Drop the trailing `;`." },
      };
    },
  },
];
