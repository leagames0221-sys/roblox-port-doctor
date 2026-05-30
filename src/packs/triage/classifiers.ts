/**
 * Deterministic error classifiers — the C / flagship pack.
 *
 * Each classifier recognizes one class of Roblox/Luau runtime error from a
 * `ParsedError` and produces a root-cause diagnosis + concrete fix + confidence.
 * They are pure and offline: no Studio, no network, no LLM (R8, ADR-007). The
 * triage engine tries them in order and falls back to "unrecognized" rather
 * than guessing (R10 — no hallucination).
 *
 * This is the file that holds Roblox runtime-error knowledge; the core triage
 * engine knows nothing of it.
 */

import type { ErrorClassifier } from "../../core/types.js";

export const TRIAGE_CLASSIFIERS: ErrorClassifier[] = [
  {
    id: "nil-index",
    match: (p) => /attempt to index (nil|a nil value)/i.test(p.message),
    diagnose: (p) => {
      const field = /index .*?with ['"]([^'"]+)['"]/i.exec(p.message)?.[1];
      const m = /index (?:field |local |global )?['"]?([\w.]+)['"]?\s*\(a nil value\)/i.exec(
        p.message,
      );
      const subject = field ?? m?.[1];
      return {
        diagnosis: subject
          ? `A value that is \`nil\` is being indexed${field ? ` to read \`.${field}\`` : ""}. The parent expression evaluated to nil at runtime${p.line ? ` (line ${p.line})` : ""}.`
          : `A nil value is being indexed; the expression to its left was nil at runtime.`,
        fix: field
          ? `Guard the parent before reading \`.${field}\`: \`if parent then ... end\`, or use \`:WaitForChild("${field}")\` if it is an Instance that should exist. For leaderstats/replicated objects, confirm the server created them before the client reads.`
          : `Add a nil check on the parent expression, or use WaitForChild for Instances that must exist before use.`,
        confidence: field ? "high" : "medium",
      };
    },
  },
  {
    id: "call-nil",
    match: (p) => /attempt to call (a nil value|nil)/i.test(p.message),
    diagnose: (p) => {
      const name = /call (?:field |method |global |local )?['"]?([\w.:]+)['"]?/i.exec(
        p.message,
      )?.[1];
      return {
        diagnosis: name
          ? `\`${name}\` is being called but is nil — the function/method does not exist on that object (typo, wrong API, or not yet assigned).`
          : `A nil value is being called as a function.`,
        fix: name
          ? `Check the spelling and the object's API for \`${name}\`. If it is a method, ensure you used \`:\` vs \`.\` correctly and that the module/service actually defines it.`
          : `Verify the callee is assigned and is actually a function before the call.`,
        confidence: name ? "high" : "medium",
      };
    },
  },
  {
    id: "nil-arithmetic",
    match: (p) => /attempt to perform arithmetic .*nil/i.test(p.message),
    diagnose: (p) => ({
      diagnosis: `Arithmetic is being performed on a nil operand${p.line ? ` (line ${p.line})` : ""} — a variable expected to be a number was nil.`,
      fix: `Initialize the variable to a number (e.g. default to 0), or guard the operation. A common cause is reading a DataStore/attribute that returned nil for a first-time player.`,
      confidence: "medium",
    }),
  },
  {
    id: "invalid-member",
    match: (p) =>
      /is not a valid member of/i.test(p.message) ||
      /Unable to assign property .*is not a valid member/i.test(p.message),
    diagnose: (p) => {
      const m = /['"]?([\w]+)['"]? is not a valid member of/i.exec(p.message);
      return {
        diagnosis: `\`${m?.[1] ?? "A child/property"}\` does not exist on that Instance at access time — wrong name, wrong parent, or it has not replicated/loaded yet.`,
        fix: `Confirm the exact instance name and hierarchy. If it is created elsewhere or replicated from the server, use \`:WaitForChild("name")\` instead of direct indexing.`,
        confidence: "high",
      };
    },
  },
  {
    id: "infinite-loop",
    match: (p) =>
      /exhausted allowed execution time/i.test(p.message) ||
      /script timeout/i.test(p.message),
    diagnose: (p) => ({
      diagnosis: `The script ran too long without yielding${p.line ? ` (line ${p.line})` : ""} — almost always a loop with no \`task.wait()\` or event yield.`,
      fix: `Add a \`task.wait()\` inside the loop body, or restructure the work to run on a RunService event (Heartbeat/Stepped) instead of a busy \`while true do\` loop.`,
      confidence: "high",
    }),
  },
  {
    id: "datastore",
    match: (p) =>
      /DataStore/i.test(p.message) &&
      /(can't be saved|not be saved|request was added to queue|requests are limited|cannot store|is not a valid|503|502)/i.test(
        p.message,
      ),
    diagnose: (p) => ({
      diagnosis: `A DataStore operation failed or was throttled${p.line ? ` (line ${p.line})` : ""} — invalid data type, key/value limits, queue saturation, or a transient service error.`,
      fix: `Wrap every *Async call in \`pcall\` and retry with backoff on failure. Only store JSON-safe values (no Instances/functions), keep keys/values within limits, and avoid bursts that fill the request queue.`,
      confidence: "medium",
    }),
  },
];
