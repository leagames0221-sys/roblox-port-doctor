/**
 * Render findings (static analysis) and diagnoses (error triage) for humans
 * (text) or machines (JSON).
 */

import type { Diagnosis, Finding, Severity } from "./types.js";

const ICON: Record<Severity, string> = {
  security: "[SEC ]",
  error: "[ERR ]",
  warning: "[WARN]",
  info: "[INFO]",
};

const CONF: Record<Diagnosis["confidence"], string> = {
  high: "★★★",
  medium: "★★",
  low: "★",
};

export interface ReportSummary {
  total: number;
  security: number;
  error: number;
  warning: number;
  info: number;
}

export function summarize(findings: Finding[]): ReportSummary {
  const s: ReportSummary = {
    total: findings.length,
    security: 0,
    error: 0,
    warning: 0,
    info: 0,
  };
  for (const f of findings) s[f.severity]++;
  return s;
}

export function renderText(findings: Finding[], filePath: string): string {
  if (findings.length === 0) {
    return `roblox-port-doctor: ${filePath}\n  No issues found.`;
  }
  const lines: string[] = [`roblox-port-doctor: ${filePath}`, ""];
  for (const f of findings) {
    const loc = f.column ? `${f.line}:${f.column}` : `${f.line}`;
    lines.push(`  ${ICON[f.severity]} ${f.ruleId}  ${filePath}:${loc}`);
    lines.push(`         ${f.message}`);
    if (f.snippet.trim()) lines.push(`         | ${f.snippet.trim()}`);
    if (f.fix) lines.push(`         fix: ${f.fix.note}`);
    lines.push("");
  }
  const s = summarize(findings);
  lines.push(
    `  ${s.total} issue(s): ${s.security} security, ${s.error} error, ${s.warning} warning, ${s.info} info`,
  );
  return lines.join("\n");
}

export function renderJson(findings: Finding[], filePath: string): string {
  return JSON.stringify(
    { file: filePath, summary: summarize(findings), findings },
    null,
    2,
  );
}

// ---- triage rendering ----

export function renderTriageText(diagnoses: Diagnosis[]): string {
  if (diagnoses.length === 0) {
    return "roblox-port-doctor triage:\n  No errors parsed from input.";
  }
  const lines: string[] = ["roblox-port-doctor triage:", ""];
  diagnoses.forEach((d, i) => {
    const loc = d.parsed.script
      ? `${d.parsed.script}:${d.parsed.line ?? "?"}`
      : "(no location)";
    lines.push(
      `  ${i + 1}. [${d.errorClass}] ${CONF[d.confidence]}  ${loc}`,
    );
    lines.push(`     error: ${d.parsed.message}`);
    lines.push(`     why:   ${d.diagnosis}`);
    lines.push(`     fix:   ${d.fix}`);
    if (d.relatedFindings?.length) {
      for (const f of d.relatedFindings) {
        lines.push(`     ↳ related static finding: ${f.ruleId} — ${f.message}`);
      }
    }
    if (d.parsed.stack.length) {
      lines.push(
        `     stack: ${d.parsed.stack
          .map((s) => `${s.script}:${s.line}${s.func ? ` (${s.func})` : ""}`)
          .join(" → ")}`,
      );
    }
    lines.push("");
  });
  const recognized = diagnoses.filter(
    (d) => d.errorClass !== "unrecognized",
  ).length;
  lines.push(
    `  ${diagnoses.length} error(s): ${recognized} recognized, ${diagnoses.length - recognized} unrecognized`,
  );
  return lines.join("\n");
}

export function renderTriageJson(diagnoses: Diagnosis[]): string {
  return JSON.stringify(
    {
      total: diagnoses.length,
      recognized: diagnoses.filter((d) => d.errorClass !== "unrecognized")
        .length,
      diagnoses,
    },
    null,
    2,
  );
}
