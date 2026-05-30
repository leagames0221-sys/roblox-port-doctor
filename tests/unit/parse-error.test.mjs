import { test } from "node:test";
import assert from "node:assert/strict";
import { parseError, parseErrorLog } from "../../dist/core/parse-error.js";
import { splitErrorBlocks } from "../../dist/core/parse-error.js";

test("parses script, line and message from a Luau error head", () => {
  const p = parseError(
    "ServerScriptService.PlayerService:42: attempt to index nil with 'leaderstats'",
  );
  assert.equal(p.script, "ServerScriptService.PlayerService");
  assert.equal(p.line, 42);
  assert.equal(p.message, "attempt to index nil with 'leaderstats'");
});

test("parses stack-trace frames", () => {
  const block = [
    "ServerScriptService.Main:10: attempt to call a nil value",
    "Stack Begin",
    "Script 'ServerScriptService.Main', Line 10 - function onJoin",
    "Script 'ServerScriptService.Main', Line 3",
    "Stack End",
  ].join("\n");
  const p = parseError(block);
  assert.equal(p.line, 10);
  assert.equal(p.stack.length, 2);
  assert.equal(p.stack[0].func, "onJoin");
  assert.equal(p.stack[1].line, 3);
});

test("strips a leading console timestamp", () => {
  const p = parseError(
    "14:03:12.456 ServerScriptService.X:7: something broke",
  );
  assert.equal(p.script, "ServerScriptService.X");
  assert.equal(p.line, 7);
});

test("tolerates a message with no location", () => {
  const p = parseError("some freeform text");
  assert.equal(p.script, undefined);
  assert.equal(p.line, undefined);
  assert.equal(p.message, "some freeform text");
});

test("splitErrorBlocks separates multiple errors", () => {
  const dump = [
    "Workspace.A:1: attempt to index nil with 'x'",
    "Stack Begin",
    "Script 'Workspace.A', Line 1",
    "Stack End",
    "Workspace.B:2: attempt to call a nil value",
  ].join("\n");
  const blocks = splitErrorBlocks(dump);
  assert.equal(blocks.length, 2);
});

test("parseErrorLog returns one ParsedError per error", () => {
  const dump =
    "Workspace.A:1: attempt to index nil with 'x'\nWorkspace.B:2: attempt to call a nil value";
  const list = parseErrorLog(dump);
  assert.equal(list.length, 2);
  assert.equal(list[0].line, 1);
  assert.equal(list[1].line, 2);
});
