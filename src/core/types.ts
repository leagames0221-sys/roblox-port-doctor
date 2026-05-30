/**
 * Core domain types. Domain-agnostic — no Roblox/UE5 specifics here.
 * Rule knowledge lives in packs/*.
 * See ADR-001 (domain-agnostic core) and ADR-006/007.
 */

export type Severity = "security" | "error" | "warning" | "info";

/** A concrete fix attached to a finding. */
export interface Fix {
  /** "replace" = mechanical, auto-applicable. "advisory" = needs human/LLM judgement. */
  kind: "replace" | "advisory";
  /** Literal substring on the offending line to replace (replace kind only). */
  original?: string;
  /** Replacement substring (replace kind only). */
  replacement?: string;
  /** Human-readable explanation / suggestion. */
  note: string;
}

/** One detected issue. */
export interface Finding {
  ruleId: string;
  pack: string;
  area: string;
  severity: Severity;
  /** 1-based line number. */
  line: number;
  /** 1-based column, if known. */
  column?: number;
  message: string;
  /** Original source line (trimmed of trailing whitespace) for display. */
  snippet: string;
  fix?: Fix;
}

/** What a rule returns when it matches a line. */
export interface RuleHit {
  /** 1-based column. */
  column?: number;
  /** Overrides the rule's default message when present. */
  message?: string;
  fix?: Fix;
}

/** Per-line context handed to every rule. */
export interface RuleContext {
  /** 1-based line number. */
  lineNo: number;
  /** 0-based index into the arrays below. */
  index: number;
  /** This line with comments + string contents blanked (columns preserved). */
  code: string;
  /** The original, unmodified line. */
  raw: string;
  /** All stripped lines (0-indexed) — for multi-line rules. */
  codeLines: string[];
  /** All original lines (0-indexed). */
  rawLines: string[];
}

/** A single static-analysis rule. */
export interface Rule {
  id: string;
  pack: string;
  area: string;
  severity: Severity;
  /** Default message; a hit may override it. */
  message: string;
  detect(ctx: RuleContext): RuleHit | null;
}

/** A named bundle of rules. */
export interface Pack {
  name: string;
  description: string;
  rules: Rule[];
}

export interface AnalyzeOptions {
  /** Pack names to run. Defaults to ["roblox"]. */
  packs?: string[];
}

// ---- Error triage (C — the flagship) ----

/** Class of a recognized Roblox/Luau runtime error. */
export type ErrorClass =
  | "nil-index"
  | "nil-arithmetic"
  | "call-nil"
  | "invalid-member"
  | "infinite-loop"
  | "datastore"
  | "unrecognized";

/** One frame of a parsed Luau stack trace. */
export interface StackFrame {
  script: string;
  line: number;
  func?: string;
}

/** A runtime error string parsed into structure (see core/parse-error.ts). */
export interface ParsedError {
  /** Script path where the error originated, if present. */
  script?: string;
  /** 1-based line, if present. */
  line?: number;
  /** The error message text (after "Script:line: "). */
  message: string;
  /** Parsed stack-trace frames (may be empty). */
  stack: StackFrame[];
  /** The original error block as given. */
  raw: string;
}

export type Confidence = "high" | "medium" | "low";

/** The result of triaging one runtime error. */
export interface Diagnosis {
  errorClass: ErrorClass;
  parsed: ParsedError;
  /** Deterministic root-cause explanation. */
  diagnosis: string;
  /** Concrete fix suggestion. */
  fix: string;
  /** ★★★ high / ★★ medium / ★ low. */
  confidence: Confidence;
  /** Static findings cross-referenced from supplied source (R9). */
  relatedFindings?: Finding[];
}

/** A deterministic classifier for one error class. */
export interface ErrorClassifier {
  id: ErrorClass;
  /** True if this classifier recognizes the parsed error. */
  match(parsed: ParsedError): boolean;
  /** Produce the diagnosis for an error this classifier matched. */
  diagnose(parsed: ParsedError): {
    diagnosis: string;
    fix: string;
    confidence: Confidence;
  };
}

// ---- LLM provider config (fix-explanation grounding only) ----

export type LlmProvider = "workers-ai" | "ollama" | "anthropic" | "stub";

export interface LlmConfig {
  provider: LlmProvider;
  accountId?: string;
  apiToken?: string;
  model?: string;
}
