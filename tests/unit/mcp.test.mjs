import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../../dist/mcp/protocol.js";

function req(id, method, params) {
  return handleMessage({ jsonrpc: "2.0", id, method, params });
}

test("initialize returns serverInfo and tools capability (R3)", () => {
  const r = req(1, "initialize", { protocolVersion: "2025-06-18" });
  assert.equal(r.id, 1);
  assert.equal(r.result.serverInfo.name, "roblox-port-doctor");
  assert.ok(r.result.capabilities.tools);
  assert.equal(r.result.protocolVersion, "2025-06-18");
});

test("notifications/initialized produces no response (R4)", () => {
  const r = handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(r, null);
});

test("tools/list advertises both tools with object inputSchema (R5)", () => {
  const r = req(2, "tools/list");
  const names = r.result.tools.map((t) => t.name);
  assert.ok(names.includes("triage_errors"));
  assert.ok(names.includes("analyze_source"));
  for (const t of r.result.tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    // handler must not leak onto the wire
    assert.equal(t.handler, undefined);
  }
});

test("tools/call triage_errors classifies a nil-index dump (R6)", () => {
  const r = req(3, "tools/call", {
    name: "triage_errors",
    arguments: {
      consoleOutput:
        "ServerScriptService.P:42: attempt to index nil with 'leaderstats'",
    },
  });
  assert.equal(r.result.isError, undefined);
  const joined = r.result.content.map((c) => c.text).join("\n");
  assert.match(joined, /nil-index/);
  assert.match(joined, /★★★/);
});

test("tools/call triage_errors cross-references source findings (R6)", () => {
  const r = req(4, "tools/call", {
    name: "triage_errors",
    arguments: {
      consoleOutput:
        "Workspace.M:1: Script timeout: exhausted allowed execution time",
      source: 'while true do\n print("x")\nend',
      packs: ["roblox"],
    },
  });
  const joined = r.result.content.map((c) => c.text).join("\n");
  assert.match(joined, /infinite-loop/);
  assert.match(joined, /RBX-PERF-001/);
});

test("tools/call analyze_source flags loadstring (R7)", () => {
  const r = req(5, "tools/call", {
    name: "analyze_source",
    arguments: { source: 'loadstring("print(1)")()' },
  });
  assert.equal(r.result.isError, undefined);
  const joined = r.result.content.map((c) => c.text).join("\n");
  assert.match(joined, /RBX-SEC-001/);
});

test("unknown method returns -32601 (R8)", () => {
  const r = req(6, "frobnicate");
  assert.equal(r.error.code, -32601);
  assert.equal(r.id, 6);
});

test("unknown tool is an in-band isError, not a protocol error (R9)", () => {
  const r = req(7, "tools/call", { name: "nope", arguments: {} });
  assert.equal(r.error, undefined);
  assert.equal(r.result.isError, true);
});

test("missing required arg returns in-band isError mentioning the field (R11)", () => {
  const r = req(8, "tools/call", { name: "triage_errors", arguments: {} });
  assert.equal(r.result.isError, true);
  const joined = r.result.content.map((c) => c.text).join("\n");
  assert.match(joined, /consoleOutput/);
});

test("analyze_source with unknown pack reports in-band isError (R9/R11)", () => {
  const r = req(9, "tools/call", {
    name: "analyze_source",
    arguments: { source: "print(1)", packs: ["does-not-exist"] },
  });
  assert.equal(r.result.isError, true);
  const joined = r.result.content.map((c) => c.text).join("\n");
  assert.match(joined, /does-not-exist/);
});
