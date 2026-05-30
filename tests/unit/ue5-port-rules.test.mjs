import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../dist/index.js";

function find(src, ruleId) {
  return analyze(src, { packs: ["ue5-port"] }).find((f) => f.ruleId === ruleId);
}

test("ue5-port pack is off by default", () => {
  assert.equal(analyze("if a && b then").length, 0);
});

test("UE5-OP-001 && -> and (replace fix)", () => {
  const f = find("if a && b then", "UE5-OP-001");
  assert.ok(f);
  assert.equal(f.fix?.kind, "replace");
  assert.equal(f.fix?.replacement, "and");
});

test("UE5-OP-002 || -> or", () => {
  assert.equal(find("if a || b then", "UE5-OP-002")?.fix?.replacement, "or");
});

test("UE5-OP-003 != -> ~=", () => {
  assert.equal(find("if a != b then", "UE5-OP-003")?.fix?.replacement, "~=");
});

test("UE5-NULL-001 null family -> nil", () => {
  assert.equal(find("local x = nullptr", "UE5-NULL-001")?.fix?.replacement, "nil");
  assert.ok(find("local x = NULL", "UE5-NULL-001"));
  assert.ok(find("if x == null then", "UE5-NULL-001"));
  assert.ok(!find("local nullable = true", "UE5-NULL-001"));
});

test("UE5-INC-001 flags ++", () => {
  assert.ok(find("i++", "UE5-INC-001"));
});

test("UE5-CPP-001 flags C++/Unreal tokens", () => {
  assert.ok(find("UE_LOG(LogTemp, Warning, x)", "UE5-CPP-001"));
  assert.ok(find("std::cout << x", "UE5-CPP-001"));
});

test("UE5-IDX-001 flags [0] index", () => {
  assert.ok(find("local first = arr[0]", "UE5-IDX-001"));
});

test("UE5-IDX-002 flags for i = 0", () => {
  assert.ok(find("for i = 0, 10 do", "UE5-IDX-002"));
});

test("UE5-AUTH-001 flags client-side authority as security", () => {
  const f = find(
    "game.Players.LocalPlayer.leaderstats.Coins = 999",
    "UE5-AUTH-001",
  );
  assert.ok(f);
  assert.equal(f.severity, "security");
});

test("UE5-SEMI-001 flags trailing semicolon", () => {
  assert.ok(find("local x = 5;", "UE5-SEMI-001"));
  assert.ok(!find("local x = 5", "UE5-SEMI-001"));
});
