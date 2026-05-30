/**
 * MCP tool catalog. Each tool is a thin adapter over the already-exported pure
 * functions (see src/index.ts) — no new domain knowledge lives here, preserving
 * the two-layer shape (ADR-001). Input is validated by hand (no schema library)
 * to keep the project at ZERO runtime dependencies (K-4, ADR-005).
 *
 * Tools take source/console *text* as arguments, never file paths — the server
 * stays a pure pass-through with no filesystem or network access (R12).
 */

import { analyze, triageErrors } from "../index.js";
import {
  renderText,
  renderJson,
  renderTriageText,
  renderTriageJson,
} from "../core/report.js";

export interface ToolContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  /** JSON Schema (literal) advertised over tools/list. */
  inputSchema: Record<string, unknown>;
  handler(args: Record<string, unknown>): ToolResult;
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function text(s: string): ToolContent {
  return { type: "text", text: s };
}

/** Validate that a value is a non-empty string. */
function requireString(
  args: Record<string, unknown>,
  field: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const v = args[field];
  if (typeof v !== "string" || v.length === 0) {
    return {
      ok: false,
      error: `Invalid arguments: "${field}" is required and must be a non-empty string.`,
    };
  }
  return { ok: true, value: v };
}

/** Validate an optional string[] argument (e.g. packs). */
function optionalStringArray(
  args: Record<string, unknown>,
  field: string,
): { ok: true; value?: string[] } | { ok: false; error: string } {
  const v = args[field];
  if (v === undefined) return { ok: true };
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    return {
      ok: false,
      error: `Invalid arguments: "${field}" must be an array of strings when present.`,
    };
  }
  return { ok: true, value: v as string[] };
}

/** Optional non-empty string (e.g. source on triage). */
function optionalString(
  args: Record<string, unknown>,
  field: string,
): { ok: true; value?: string } | { ok: false; error: string } {
  const v = args[field];
  if (v === undefined) return { ok: true };
  if (typeof v !== "string") {
    return { ok: false, error: `Invalid arguments: "${field}" must be a string when present.` };
  }
  return { ok: true, value: v };
}

export const TOOLS: McpTool[] = [
  {
    name: "triage_errors",
    description:
      "Turn a Roblox/Luau runtime console error dump (exactly what the Studio " +
      "console or the official MCP get_console_output tool emits) into a " +
      "deterministic diagnosis + concrete fix per error. Unknown errors are " +
      "reported as 'unrecognized' rather than guessed. Offline and deterministic.",
    inputSchema: {
      type: "object",
      properties: {
        consoleOutput: {
          type: "string",
          description: "Raw console/error text to triage (one or more errors).",
        },
        source: {
          type: "string",
          description:
            "Optional Luau source of the errored script; enables cross-referencing " +
            "static findings on the errored line.",
        },
        packs: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional rule packs for the cross-reference analysis (default: roblox). " +
            "Available: roblox, ue5-port.",
        },
      },
      required: ["consoleOutput"],
    },
    handler(args) {
      const co = requireString(args, "consoleOutput");
      if (!co.ok) return errorResult(co.error);
      const src = optionalString(args, "source");
      if (!src.ok) return errorResult(src.error);
      const packs = optionalStringArray(args, "packs");
      if (!packs.ok) return errorResult(packs.error);

      try {
        const findings =
          src.value !== undefined
            ? analyze(src.value, { packs: packs.value })
            : undefined;
        const diagnoses = triageErrors(co.value, {
          source: src.value,
          findings,
        });
        return {
          content: [
            text(renderTriageText(diagnoses)),
            text(renderTriageJson(diagnoses)),
          ],
        };
      } catch (err) {
        return errorResult(
          `triage_errors failed: ${(err as Error).message}`,
        );
      }
    },
  },
  {
    name: "analyze_source",
    description:
      "Run static analysis over Luau source text: security/server-authority/" +
      "reliability rules (roblox pack, default) and optional UE5->Luau port " +
      "pitfalls (ue5-port pack). Returns findings with rule id, severity, line, " +
      "message and fix. Deterministic; does not duplicate luau-analyze/selene.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Luau source text to analyze.",
        },
        packs: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional rule packs (default: roblox). Available: roblox, ue5-port.",
        },
      },
      required: ["source"],
    },
    handler(args) {
      const src = requireString(args, "source");
      if (!src.ok) return errorResult(src.error);
      const packs = optionalStringArray(args, "packs");
      if (!packs.ok) return errorResult(packs.error);

      try {
        const findings = analyze(src.value, { packs: packs.value });
        return {
          content: [
            text(renderText(findings, "<source>")),
            text(renderJson(findings, "<source>")),
          ],
        };
      } catch (err) {
        // Unknown pack name throws in collectRules — report in-band (R9).
        return errorResult(`analyze_source failed: ${(err as Error).message}`);
      }
    },
  },
];

/** The tool catalog as advertised over tools/list (no handler on the wire). */
export function toolCatalog(): Array<Omit<McpTool, "handler">> {
  return TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

/** Look up a tool by name. */
export function findTool(name: string): McpTool | undefined {
  return TOOLS.find((t) => t.name === name);
}
