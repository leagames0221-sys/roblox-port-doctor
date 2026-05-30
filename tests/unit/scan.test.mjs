import { test } from "node:test";
import assert from "node:assert/strict";
import { stripSource } from "../../dist/core/scan.js";

test("blanks line-comment bodies", () => {
  const [line] = stripSource("x = 1 -- wait() here");
  assert.ok(!line.includes("wait("), "comment body should be blanked");
  assert.ok(line.startsWith("x = 1 "), "code before comment preserved");
});

test("blanks string contents but keeps quotes", () => {
  const [line] = stripSource('local s = "wait() && null"');
  assert.ok(!line.includes("wait("));
  assert.ok(!line.includes("&&"));
  assert.ok(line.includes('"'), "quotes are preserved");
});

test("preserves column positions (length unchanged)", () => {
  const src = 'local s = "hidden" -- comment';
  const [line] = stripSource(src);
  assert.equal(line.length, src.length);
});

test("handles block comments spanning lines", () => {
  const lines = stripSource("a\n--[[\nwait()\n]]\nb");
  assert.ok(!lines[2].includes("wait("), "block comment body blanked");
  assert.equal(lines[0].trim(), "a");
  assert.equal(lines[4].trim(), "b");
});

test("handles long-bracket strings spanning lines", () => {
  const lines = stripSource("local s = [[\n&& null\n]]\nx = 1");
  assert.ok(!lines[1].includes("&&"));
  assert.equal(lines[3].trim(), "x = 1");
});

test("leaves real code intact", () => {
  const [line] = stripSource("task.wait(1)");
  assert.equal(line, "task.wait(1)");
});
