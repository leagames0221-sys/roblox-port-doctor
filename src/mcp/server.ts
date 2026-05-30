#!/usr/bin/env node
/**
 * MCP stdio server shell (the only impure file in src/mcp/).
 *
 * Reads newline-delimited JSON-RPC 2.0 messages from stdin, hands each parsed
 * message to the pure `handleMessage`, and writes exactly one single-line JSON
 * response per non-null result to stdout. All logging goes to stderr — stdout
 * carries ONLY MCP messages (R1/R2), as the spec requires.
 *
 * Zero runtime dependencies — Node built-ins only (ADR-008, Option B).
 */

import { handleMessage, type JsonRpcMessage } from "./protocol.js";

function send(obj: object): void {
  // Single line, no embedded newlines (spec: messages are newline-delimited and
  // MUST NOT contain embedded newlines). JSON.stringify without indent is single-line.
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function parseError(id: number | string | null): object {
  return { jsonrpc: "2.0", id, error: { code: -32700, message: "Parse error" } };
}

function processLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg: JsonRpcMessage;
  try {
    msg = JSON.parse(trimmed) as JsonRpcMessage;
  } catch {
    // Bad JSON → -32700, id null, keep going (R10).
    send(parseError(null));
    return;
  }

  let response: object | null;
  try {
    response = handleMessage(msg);
  } catch (err) {
    // handleMessage is designed never to throw, but stay defensive.
    process.stderr.write(`roblox-port-doctor-mcp: handler error: ${(err as Error).message}\n`);
    response = {
      jsonrpc: "2.0",
      id: msg.id ?? null,
      error: { code: -32603, message: "Internal error" },
    };
  }
  if (response !== null) send(response);
}

function main(): void {
  process.stderr.write(
    "roblox-port-doctor-mcp: stdio server ready (zero-dependency). Tools: triage_errors, analyze_source.\n",
  );

  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      processLine(line);
    }
  });
  process.stdin.on("end", () => {
    if (buffer.trim()) processLine(buffer);
  });
  process.stdin.resume();
}

main();
