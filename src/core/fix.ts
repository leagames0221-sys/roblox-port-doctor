/**
 * Fix application + (optional) LLM-grounded explanation.
 *
 * Mechanical fixes (kind: "replace") are applied deterministically to produce a
 * patched source. Semantic fixes (kind: "advisory") are listed for the human /
 * LLM to act on. See ADR-003.
 */

import type { Finding } from "./types.js";
import type { LlmClient } from "./llm.js";

export interface FixResult {
  fixedSource: string;
  appliedCount: number;
  /** Findings that could not be auto-fixed (advisory or no fix). */
  advisories: Finding[];
}

/**
 * Apply every deterministic "replace" fix to the source. Each fix replaces the
 * first occurrence of `original` on its own line. Advisory findings are
 * collected, not applied.
 */
export function applyDeterministicFixes(
  source: string,
  findings: Finding[],
): FixResult {
  const lines = source.split(/\r?\n/);
  let appliedCount = 0;
  const advisories: Finding[] = [];

  for (const f of findings) {
    const fix = f.fix;
    if (
      fix &&
      fix.kind === "replace" &&
      fix.original !== undefined &&
      fix.replacement !== undefined
    ) {
      const idx = f.line - 1;
      if (lines[idx] !== undefined && lines[idx].includes(fix.original)) {
        lines[idx] = lines[idx].replace(fix.original, fix.replacement);
        appliedCount++;
        continue;
      }
    }
    advisories.push(f);
  }

  return { fixedSource: lines.join("\n"), appliedCount, advisories };
}

const SYSTEM_PROMPT =
  "You are a senior Roblox/Luau engineer doing code review. For each numbered " +
  "finding, give a one or two sentence explanation of why it is a bug and the " +
  "concrete fix. Be specific to Luau (1-based tables, task library, " +
  "server-authority, DataStore pcall). Do not invent issues beyond those listed.";

/**
 * Ask the LLM to elaborate on the findings. Returns "" when the client is a
 * stub (no provider configured) so callers transparently fall back to the
 * deterministic rule messages.
 */
export async function explainFindings(
  findings: Finding[],
  llm: LlmClient,
): Promise<string> {
  if (findings.length === 0) return "";
  const list = findings
    .map(
      (f, n) =>
        `${n + 1}. [${f.ruleId}] line ${f.line}: ${f.message}\n   code: ${f.snippet.trim()}`,
    )
    .join("\n");
  const prompt = `Here are static-analysis findings for a Luau script. Explain and fix each:\n\n${list}`;
  return llm.complete(prompt, SYSTEM_PROMPT);
}
