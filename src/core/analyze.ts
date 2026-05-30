/**
 * The analysis engine. Domain-agnostic: it runs whatever rules the selected
 * packs inject over a stripped view of the source, line by line.
 * See ADR-001, ADR-003.
 */

import type { Finding, Rule, RuleContext } from "./types.js";
import { stripSource } from "./scan.js";

const SEVERITY_ORDER: Record<string, number> = {
  security: 0,
  error: 1,
  warning: 2,
  info: 3,
};

/**
 * Run a set of rules over Luau source and return findings sorted by
 * (line, severity).
 */
export function analyzeSource(source: string, rules: Rule[]): Finding[] {
  const codeLines = stripSource(source);
  const rawLines = source.split(/\r?\n/);
  const findings: Finding[] = [];

  for (let i = 0; i < codeLines.length; i++) {
    const ctx: RuleContext = {
      lineNo: i + 1,
      index: i,
      code: codeLines[i],
      raw: rawLines[i] ?? "",
      codeLines,
      rawLines,
    };
    for (const rule of rules) {
      const hit = rule.detect(ctx);
      if (!hit) continue;
      findings.push({
        ruleId: rule.id,
        pack: rule.pack,
        area: rule.area,
        severity: rule.severity,
        line: ctx.lineNo,
        column: hit.column,
        message: hit.message ?? rule.message,
        snippet: ctx.raw.replace(/\s+$/, ""),
        fix: hit.fix,
      });
    }
  }

  findings.sort(
    (a, b) =>
      a.line - b.line ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );
  return findings;
}
