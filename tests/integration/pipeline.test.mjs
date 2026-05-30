import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, triageErrors } from "../../dist/index.js";
import { applyDeterministicFixes } from "../../dist/core/fix.js";
import {
  renderJson,
  renderText,
  renderTriageText,
  renderTriageJson,
  summarize,
} from "../../dist/core/report.js";

// A deliberately buggy Luau snippet: a UE5/C++ habit ported to Roblox.
const BUGGY = `local Players = game:GetService("Players")
local store = game:GetService("DataStoreService"):GetDataStore("Coins")

local function onJoin(plr)
    local coins = store:GetAsync(plr.UserId)   -- no pcall
    if coins != nil then                       -- C++ operator
        plr.leaderstats.Coins.Value = coins
    end
end

Players.PlayerAdded:Connect(onJoin)

remote.OnServerEvent:Connect(function(plr, amount)
    plr.leaderstats.Coins.Value = plr.leaderstats.Coins.Value + amount  -- trusts client
end)

while true do
    print("polling")                            -- no yield -> freeze
end`;

test("static: roblox + ue5-port packs find the planted bugs", () => {
  const findings = analyze(BUGGY, { packs: ["roblox", "ue5-port"] });
  const got = new Set(findings.map((f) => f.ruleId));
  assert.ok(got.has("RBX-DS-001"), "DataStore without pcall");
  assert.ok(got.has("RBX-SEC-003"), "OnServerEvent validation");
  assert.ok(got.has("RBX-PERF-001"), "busy loop");
  assert.ok(got.has("UE5-OP-003"), "!= operator");
});

test("static: at least one security-severity finding", () => {
  const findings = analyze(BUGGY, { packs: ["roblox", "ue5-port"] });
  assert.ok(summarize(findings).security >= 1);
});

test("static: != gets mechanically fixed", () => {
  const findings = analyze(BUGGY, { packs: ["roblox", "ue5-port"] });
  const { fixedSource, appliedCount } = applyDeterministicFixes(BUGGY, findings);
  assert.ok(appliedCount >= 1);
  assert.ok(fixedSource.includes("coins ~= nil"));
  assert.ok(!fixedSource.includes("coins != nil"));
});

test("static: renderJson is valid JSON with summary", () => {
  const findings = analyze(BUGGY, { packs: ["roblox", "ue5-port"] });
  const parsed = JSON.parse(renderJson(findings, "buggy.lua"));
  assert.equal(parsed.file, "buggy.lua");
  assert.equal(parsed.summary.total, findings.length);
});

test("static: renderText reports clean file with no issues", () => {
  const text = renderText(analyze("local x = 1\n"), "clean.lua");
  assert.match(text, /No issues found/);
});

// ---- triage end-to-end (C) ----

const CONSOLE_DUMP = `14:03:12.456 ServerScriptService.PlayerService:7: attempt to index nil with 'leaderstats'
Stack Begin
Script 'ServerScriptService.PlayerService', Line 7 - function onJoin
Stack End
ServerScriptService.Loop:18: Script timeout: exhausted allowed execution time`;

test("triage: parses a real-shaped console dump into 2 diagnoses", () => {
  const ds = triageErrors(CONSOLE_DUMP);
  assert.equal(ds.length, 2);
  assert.equal(ds[0].errorClass, "nil-index");
  assert.equal(ds[1].errorClass, "infinite-loop");
});

test("triage: renderTriageText shows class, confidence and fix", () => {
  const txt = renderTriageText(triageErrors(CONSOLE_DUMP));
  assert.match(txt, /nil-index/);
  assert.match(txt, /★★★/);
  assert.match(txt, /fix:/);
});

test("triage: renderTriageJson is valid JSON with recognized count", () => {
  const parsed = JSON.parse(renderTriageJson(triageErrors(CONSOLE_DUMP)));
  assert.equal(parsed.total, 2);
  assert.equal(parsed.recognized, 2);
});
