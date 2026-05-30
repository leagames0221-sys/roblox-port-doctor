import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../dist/index.js";
import { applyDeterministicFixes, explainFindings } from "../../dist/core/fix.js";
import { StubLlmClient } from "../../dist/core/llm.js";

test("applies mechanical replace fixes", () => {
  const src = "if a && b then";
  const findings = analyze(src, { packs: ["ue5-port"] });
  const { fixedSource, appliedCount } = applyDeterministicFixes(src, findings);
  assert.equal(appliedCount, 1);
  assert.equal(fixedSource, "if a and b then");
});

test("collects advisory findings, does not mutate them", () => {
  // loadstring -> RBX-SEC-001 (advisory, not auto-fixable)
  const src = "loadstring(x)";
  const findings = analyze(src);
  const { fixedSource, appliedCount, advisories } = applyDeterministicFixes(
    src,
    findings,
  );
  assert.equal(appliedCount, 0);
  assert.equal(fixedSource, src);
  assert.equal(advisories.length, 1);
});

test("applies multiple replace fixes on one line", () => {
  const src = "x = a != b";
  const findings = analyze(src, { packs: ["ue5-port"] });
  const { fixedSource } = applyDeterministicFixes(src, findings);
  assert.equal(fixedSource, "x = a ~= b");
});

test("explainFindings returns '' with stub client (graceful fallback)", async () => {
  const findings = analyze("loadstring(x)");
  const prose = await explainFindings(findings, new StubLlmClient());
  assert.equal(prose, "");
});
