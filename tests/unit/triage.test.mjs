import { test } from "node:test";
import assert from "node:assert/strict";
import { triageErrors, analyze } from "../../dist/index.js";

function one(text, opts) {
  return triageErrors(text, opts)[0];
}

test("classifies nil-index with the field name (high confidence)", () => {
  const d = one(
    "ServerScriptService.P:42: attempt to index nil with 'leaderstats'",
  );
  assert.equal(d.errorClass, "nil-index");
  assert.equal(d.confidence, "high");
  assert.match(d.fix, /leaderstats/);
});

test("classifies call-nil", () => {
  const d = one("Workspace.M:3: attempt to call a nil value (field 'doThing')");
  assert.equal(d.errorClass, "call-nil");
});

test("classifies nil-arithmetic", () => {
  const d = one("Workspace.M:5: attempt to perform arithmetic (add) on nil");
  assert.equal(d.errorClass, "nil-arithmetic");
});

test("classifies invalid-member", () => {
  const d = one("Workspace.M:7: Coins is not a valid member of Folder \"leaderstats\"");
  assert.equal(d.errorClass, "invalid-member");
  assert.equal(d.confidence, "high");
});

test("classifies infinite-loop", () => {
  const d = one("Workspace.M:9: Script timeout: exhausted allowed execution time");
  assert.equal(d.errorClass, "infinite-loop");
  assert.equal(d.confidence, "high");
});

test("classifies datastore failure", () => {
  const d = one(
    "ServerScriptService.Save:12: 103: Cannot store Instance in DataStore",
  );
  assert.equal(d.errorClass, "datastore");
});

test("falls back to unrecognized rather than guessing (R10)", () => {
  const d = one("Workspace.M:1: a brand new error we have never seen");
  assert.equal(d.errorClass, "unrecognized");
  assert.equal(d.confidence, "low");
  assert.match(d.diagnosis, /not recognized/i);
});

test("triages multiple errors from one dump", () => {
  const dump =
    "A:1: attempt to index nil with 'x'\nB:2: attempt to call a nil value";
  const ds = triageErrors(dump);
  assert.equal(ds.length, 2);
  assert.equal(ds[0].errorClass, "nil-index");
  assert.equal(ds[1].errorClass, "call-nil");
});

test("cross-references static findings on the same line (R9)", () => {
  const src = 'while true do\n print("x")\nend';
  const findings = analyze(src, { packs: ["roblox"] });
  const d = one(
    "Workspace.M:1: Script timeout: exhausted allowed execution time",
    { source: src, findings },
  );
  assert.ok(d.relatedFindings && d.relatedFindings.length >= 1);
  assert.equal(d.relatedFindings[0].ruleId, "RBX-PERF-001");
});
