#!/usr/bin/env node
/**
 * CLI entry.
 *
 * Static analysis:
 *   roblox-port-doctor path/to/script.lua
 *   roblox-port-doctor script.luau --packs roblox,ue5-port
 *   roblox-port-doctor script.luau --json
 *   roblox-port-doctor script.luau --fix      # print the auto-fixed source
 *   roblox-port-doctor script.luau --explain  # add LLM-grounded prose (needs creds)
 *
 * Error triage (C — flagship):
 *   roblox-port-doctor --triage error.log              # parse a console dump
 *   roblox-port-doctor --triage error.log --src s.lua  # cross-ref static findings
 *   cat error.log | roblox-port-doctor --triage        # from stdin
 *
 * Exit code: 0 = clean, 1 = findings/errors, 2 = usage/IO error.
 */

import { readFileSync } from "node:fs";
import { analyze, triageErrors } from "./index.js";
import { applyDeterministicFixes, explainFindings } from "./core/fix.js";
import {
  renderText,
  renderJson,
  renderTriageText,
  renderTriageJson,
  summarize,
} from "./core/report.js";
import { createLlmClient, loadConfigFromEnv } from "./core/llm.js";
import { DEFAULT_PACKS } from "./packs/index.js";

interface Args {
  file?: string;
  packs: string[];
  json: boolean;
  fix: boolean;
  explain: boolean;
  help: boolean;
  triage: boolean;
  triageFile?: string;
  src?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    packs: DEFAULT_PACKS,
    json: false,
    fix: false,
    explain: false,
    help: false,
    triage: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--json") args.json = true;
    else if (a === "--fix") args.fix = true;
    else if (a === "--explain") args.explain = true;
    else if (a === "--triage") {
      args.triage = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) args.triageFile = argv[++i];
    } else if (a === "--src") args.src = argv[++i];
    else if (a === "--packs") args.packs = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a.startsWith("--packs=")) args.packs = a.slice(8).split(",").filter(Boolean);
    else if (!a.startsWith("-")) args.file = a;
  }
  if (!args.packs.length) args.packs = DEFAULT_PACKS;
  return args;
}

const USAGE = `roblox-port-doctor — AI-assisted Luau/Roblox debug automation

Static analysis:
  roblox-port-doctor <file.lua|file.luau> [options]

Options:
  --packs <a,b>      Rule packs to run (default: roblox). Available: roblox, ue5-port
  --json             Output as JSON
  --fix              Print the source with mechanical fixes applied
  --explain          Add LLM-grounded explanations (uses env-configured provider)

Error triage:
  roblox-port-doctor --triage [error.log]   Parse a console dump (or stdin) into
                                            diagnoses + fixes
  --src <file>       Cross-reference static findings for the errored source

  -h, --help         Show this help

Exit codes: 0 clean, 1 findings/errors present, 2 usage/IO error`;

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function runTriage(args: Args): Promise<number> {
  let input = "";
  if (args.triageFile) {
    try {
      input = readFileSync(args.triageFile, "utf8");
    } catch {
      console.error(`roblox-port-doctor: cannot read file: ${args.triageFile}`);
      return 2;
    }
  } else {
    input = readStdin();
  }
  if (!input.trim()) {
    console.error("roblox-port-doctor: no error input (give a file or pipe via stdin)");
    return 2;
  }

  let findings;
  let srcText: string | undefined;
  if (args.src) {
    try {
      srcText = readFileSync(args.src, "utf8");
      findings = analyze(srcText, { packs: args.packs });
    } catch {
      console.error(`roblox-port-doctor: cannot read --src file: ${args.src}`);
      return 2;
    }
  }

  const diagnoses = triageErrors(input, { source: srcText, findings });
  if (args.json) console.log(renderTriageJson(diagnoses));
  else console.log(renderTriageText(diagnoses));

  return diagnoses.length > 0 ? 1 : 0;
}

async function runAnalyze(args: Args): Promise<number> {
  let source: string;
  try {
    source = readFileSync(args.file as string, "utf8");
  } catch {
    console.error(`roblox-port-doctor: cannot read file: ${args.file}`);
    return 2;
  }

  let findings;
  try {
    findings = analyze(source, { packs: args.packs });
  } catch (err) {
    console.error(`roblox-port-doctor: ${(err as Error).message}`);
    return 2;
  }

  if (args.json) console.log(renderJson(findings, args.file as string));
  else console.log(renderText(findings, args.file as string));

  if (args.fix) {
    const { fixedSource, appliedCount } = applyDeterministicFixes(source, findings);
    console.log(`\n--- fixed source (${appliedCount} mechanical fix(es) applied) ---`);
    console.log(fixedSource);
  }

  if (args.explain) {
    const llm = createLlmClient(loadConfigFromEnv());
    const prose = await explainFindings(findings, llm);
    if (prose.trim()) {
      console.log("\n--- LLM explanation ---");
      console.log(prose.trim());
    } else {
      console.log(
        "\n(no LLM explanation: set CF_ACCOUNT_ID + CF_API_TOKEN, or LLM_PROVIDER)",
      );
    }
  }

  return summarize(findings).total > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.triage) return runTriage(args);
  if (!args.file) {
    console.log(USAGE);
    return 2;
  }
  return runAnalyze(args);
}

main().then((code) => process.exit(code));
