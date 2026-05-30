/**
 * Public API surface. Domain-agnostic core + pack injection.
 *
 *   import { analyze, applyDeterministicFixes, triageErrors } from "roblox-port-doctor";
 *   const findings = analyze(source, { packs: ["roblox", "ue5-port"] });
 *   const diagnoses = triageErrors(consoleOutput, { source, findings });
 */

import { analyzeSource } from "./core/analyze.js";
import { triage, type TriageOptions } from "./core/triage.js";
import { collectRules, DEFAULT_PACKS } from "./packs/index.js";
import { triageClassifiers } from "./packs/triage/index.js";
import type { AnalyzeOptions, Diagnosis, Finding } from "./core/types.js";

export function analyze(source: string, opts: AnalyzeOptions = {}): Finding[] {
  const packs = opts.packs && opts.packs.length ? opts.packs : DEFAULT_PACKS;
  const rules = collectRules(packs);
  return analyzeSource(source, rules);
}

/** Triage raw Roblox/Luau console error output into structured diagnoses. */
export function triageErrors(
  consoleOutput: string,
  opts: TriageOptions = {},
): Diagnosis[] {
  return triage(consoleOutput, triageClassifiers, opts);
}

export { applyDeterministicFixes, explainFindings } from "./core/fix.js";
export {
  renderText,
  renderJson,
  renderTriageText,
  renderTriageJson,
  summarize,
} from "./core/report.js";
export { parseErrorLog, parseError } from "./core/parse-error.js";
export { collectRules, PACKS, DEFAULT_PACKS } from "./packs/index.js";
export { triageClassifiers } from "./packs/triage/index.js";
export { createLlmClient, loadConfigFromEnv } from "./core/llm.js";
export * from "./core/types.js";
