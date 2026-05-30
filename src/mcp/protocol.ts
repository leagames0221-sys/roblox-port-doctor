/**
 * The MCP "brain": a PURE message handler. Given one parsed JSON-RPC message it
 * returns the response object (or null for notifications). It performs NO I/O —
 * the impure stdin/stdout shell lives in server.ts. This makes the entire MCP
 * surface unit-testable without spawning a process or a real client (N3).
 *
 * Implements the minimal MCP stdio method set verified against the spec
 * (docs/evidence/2026-05-30-stage1-mcp-wrapper-discovery.md, F4):
 *   initialize, notifications/initialized, tools/list, tools/call.
 * Everything else → JSON-RPC -32601 (Method not found).
 *
 * Zero runtime dependencies: hand-written, no SDK (ADR-008, Option B).
 */

import { findTool, toolCatalog } from "./tools.js";

/** Protocol version we implement; we echo the client's if compatible-looking. */
const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "roblox-port-doctor", version: "0.1.0" };

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Id = number | string | null;

function result(id: Id, value: unknown): object {
  return { jsonrpc: "2.0", id, result: value };
}

function error(id: Id, code: number, message: string): object {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Handle one parsed JSON-RPC message.
 * Returns the response object, or null when no response is due (notifications).
 * Never throws.
 */
export function handleMessage(msg: JsonRpcMessage): object | null {
  const id: Id = msg.id ?? null;
  const method = msg.method;

  // Notifications carry no id and expect no response (R4).
  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  switch (method) {
    case "initialize": {
      const clientVersion = (msg.params?.protocolVersion as string) || PROTOCOL_VERSION;
      return result(id, {
        protocolVersion: clientVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }

    case "ping":
      // Common keep-alive; harmless empty result.
      return result(id, {});

    case "tools/list":
      return result(id, { tools: toolCatalog() });

    case "tools/call": {
      const name = msg.params?.name as string | undefined;
      const args =
        (msg.params?.arguments as Record<string, unknown> | undefined) ?? {};
      if (typeof name !== "string") {
        return result(id, {
          content: [
            { type: "text", text: 'Invalid tools/call: "name" is required.' },
          ],
          isError: true,
        });
      }
      const tool = findTool(name);
      if (!tool) {
        // Tool-level errors are reported in-band, not as protocol errors (R9).
        return result(id, {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        });
      }
      return result(id, tool.handler(args));
    }

    default:
      return error(id, -32601, `Method not found: ${method ?? "(none)"}`);
  }
}
