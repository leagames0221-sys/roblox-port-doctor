import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../dist/index.js";
import { collectRules } from "../../dist/packs/index.js";

test("default pack is roblox", () => {
  // loadstring is a roblox-pack security rule (not covered by official linter)
  const f = analyze("loadstring(x)");
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, "RBX-SEC-001");
});

test("does not flag code inside strings/comments", () => {
  assert.equal(analyze('local s = "loadstring(x)"').length, 0);
  assert.equal(analyze("x = 1 -- loadstring(x)").length, 0);
});

test("findings are sorted by line then severity", () => {
  const src = 'Instance.new("P", w)\nloadstring(c)';
  const f = analyze(src);
  assert.equal(f[0].line, 1);
  assert.equal(f[1].line, 2);
  assert.equal(f[1].severity, "security");
});

test("unknown pack throws", () => {
  assert.throws(() => analyze("x", { packs: ["nope"] }), /Unknown pack/);
});

test("collectRules dedupes by id across packs", () => {
  const rules = collectRules(["roblox", "roblox"]);
  const ids = new Set(rules.map((r) => r.id));
  assert.equal(ids.size, rules.length);
});

test("snippet trims trailing whitespace", () => {
  const f = analyze("loadstring(x)    ");
  assert.equal(f[0].snippet, "loadstring(x)");
});
