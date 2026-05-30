/**
 * Parse Roblox/Luau runtime error text into structure (R7).
 *
 * Roblox surfaces runtime errors in a recognizable shape, e.g.
 *
 *   ServerScriptService.PlayerService:42: attempt to index nil with 'leaderstats'
 *   Stack Begin
 *   Script 'ServerScriptService.PlayerService', Line 42 - function onJoin
 *   Stack End
 *
 * This module turns the message line (and any stack frames) into a `ParsedError`.
 * It is the input boundary for the triage engine, and is intentionally tolerant:
 * the message line may appear with or without a stack, and a raw block from the
 * official MCP `get_console_output` tool (which can contain several errors) is
 * split by `splitErrorBlocks`. See ADR-007.
 */

import type { ParsedError, StackFrame } from "./types.js";

/** `Script.Path:LINE: message` — the canonical Luau error head. */
const HEAD_RE = /^\s*(?:\d{1,2}:\d{2}:\d{2}\.\d+\s+)?([\w.\/\\-]+):(\d+):\s*(.*)$/;

/** `Script 'Path', Line N - function name` — a stack frame line. */
const FRAME_RE =
  /Script\s+['"]?([\w.\/\\-]+)['"]?\s*,\s*Line\s+(\d+)(?:\s*-\s*(?:function\s+)?(.+?))?\s*$/i;

/**
 * Split a raw console dump into individual error blocks. Each block starts at a
 * line that looks like an error head and runs until the next head (stack lines
 * in between are attached to the preceding head).
 */
export function splitErrorBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  const isHead = (l: string) => HEAD_RE.test(l) && !FRAME_RE.test(l);

  for (const line of lines) {
    if (isHead(line)) {
      if (current.length) blocks.push(current.join("\n"));
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

/** Parse a single error block into a `ParsedError`. */
export function parseError(block: string): ParsedError {
  const raw = block;
  const lines = block.split(/\r?\n/);
  let script: string | undefined;
  let line: number | undefined;
  let message = block.trim();
  const stack: StackFrame[] = [];

  for (const l of lines) {
    const head = HEAD_RE.exec(l);
    if (head && !FRAME_RE.test(l) && script === undefined) {
      script = head[1];
      line = Number(head[2]);
      message = head[3].trim();
      continue;
    }
    const frame = FRAME_RE.exec(l);
    if (frame) {
      stack.push({
        script: frame[1],
        line: Number(frame[2]),
        func: frame[3]?.trim() || undefined,
      });
    }
  }

  // If the head had no stack but a frame later named the same script, fine.
  // If no head matched at all, message stays as the trimmed raw block.
  return { script, line, message, stack, raw };
}

/** Parse a raw dump (possibly several errors) into ParsedError[]. */
export function parseErrorLog(text: string): ParsedError[] {
  return splitErrorBlocks(text)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(parseError);
}
