import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../dist/index.js";

function ids(src) {
  return analyze(src, { packs: ["roblox"] }).map((f) => f.ruleId);
}

// Deprecation of bare wait()/spawn()/delay() is intentionally NOT covered:
// it duplicates the official luau-analyze DeprecatedGlobal lint (ADR-006).
test("bare wait()/spawn() are NOT flagged (delegated to official linter)", () => {
  assert.equal(ids("wait(1)").length, 0);
  assert.equal(ids("spawn(fn)").length, 0);
  assert.equal(ids("delay(1, fn)").length, 0);
});

test("RBX-PERF-002 flags Parent in Instance.new", () => {
  assert.ok(ids('Instance.new("Part", workspace)').includes("RBX-PERF-002"));
  assert.ok(!ids('Instance.new("Part")').includes("RBX-PERF-002"));
});

test("RBX-NIL-001 flags chained FindFirstChild", () => {
  assert.ok(ids('workspace:FindFirstChild("A").Name').includes("RBX-NIL-001"));
  assert.ok(!ids('local a = workspace:FindFirstChild("A")').includes("RBX-NIL-001"));
});

test("RBX-SEC-001 flags loadstring as security", () => {
  const f = analyze("loadstring(s)()", { packs: ["roblox"] });
  assert.ok(f.some((x) => x.ruleId === "RBX-SEC-001" && x.severity === "security"));
});

test("RBX-SEC-002 flags require by asset id", () => {
  assert.ok(ids("require(123456)").includes("RBX-SEC-002"));
  assert.ok(!ids("require(script.Module)").includes("RBX-SEC-002"));
});

test("RBX-SEC-003 flags OnServerEvent handler", () => {
  assert.ok(ids("remote.OnServerEvent:Connect(handler)").includes("RBX-SEC-003"));
});

test("RBX-DS-001 flags unguarded Async, not pcall-wrapped", () => {
  assert.ok(ids("store:SetAsync(key, val)").includes("RBX-DS-001"));
  assert.ok(
    !ids("local ok = pcall(function() store:SetAsync(key, val) end)").includes(
      "RBX-DS-001",
    ),
  );
});

test("RBX-PERF-001 flags yield-free while true loop", () => {
  assert.ok(ids('while true do\n print("x")\nend').includes("RBX-PERF-001"));
  assert.ok(!ids("while true do\n task.wait()\nend").includes("RBX-PERF-001"));
});

test("roblox pack is 7 rules after DEP pruning", () => {
  // sanity: no RBX-DEP-* ids remain
  const all = analyze(
    'wait(1)\nspawn(f)\nInstance.new("P", w)\nloadstring(x)\nstore:SetAsync(k,v)\nremote.OnServerEvent:Connect(h)\nwhile true do print(1) end',
    { packs: ["roblox"] },
  ).map((f) => f.ruleId);
  assert.ok(!all.some((id) => id.startsWith("RBX-DEP-")));
});
