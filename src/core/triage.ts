/**
 * The triage engine (C — flagship). Domain-agnostic: it parses runtime error
 * text and runs whatever `ErrorClassifier`s it is given, falling back to
 * "unrecognized" rather than guessing (R7/R8/R10/R12, ADR-007).
 *
 * Input is the raw text a Roblox console (or the official MCP `get_console_output`
 * tool) produces; output is structured `Diagnosis[]`. This module owns no
 * per-error-class knowledge — that lives in packs/triage.
 */

import type {
  Diagnosis,
  ErrorClassifier,
  Finding,
  ParsedError,
} from "./types.js";
import { parseErrorLog } from "./parse-error.js";

export interface TriageOptions {
  /** Optional source text keyed by script name, to cross-reference findings (R9). */
  source?: string;
  /** Static findings for the supplied source, to attach to matching lines (R9). */
  findings?: Finding[];
}

function diagnoseOne(
  parsed: ParsedError,
  classifiers: ErrorClassifier[],
  opts: TriageOptions,
): Diagnosis {
  for (const c of classifiers) {
    if (!c.match(parsed)) continue;
    const { diagnosis, fix, confidence } = c.diagnose(parsed);
    const related =
      opts.findings && parsed.line
        ? opts.findings.filter((f) => f.line === parsed.line)
        : undefined;
    return {
      errorClass: c.id,
      parsed,
      diagnosis,
      fix,
      confidence,
      relatedFindings: related && related.length ? related : undefined,
    };
  }
  return {
    errorClass: "unrecognized",
    parsed,
    diagnosis:
      "This error was not recognized by any classifier. No deterministic diagnosis is offered (rather than guess).",
    fix: "Inspect the script and line manually, or run with --explain to ask the configured LLM.",
    confidence: "low",
  };
}

/** Triage a raw error dump into one diagnosis per detected error. */
export function triage(
  text: string,
  classifiers: ErrorClassifier[],
  opts: TriageOptions = {},
): Diagnosis[] {
  const parsedList = parseErrorLog(text);
  return parsedList.map((p) => diagnoseOne(p, classifiers, opts));
}
