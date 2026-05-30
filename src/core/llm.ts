/**
 * LLM provider abstraction — used ONLY to enrich fix explanations.
 *
 * The analyzer is fully deterministic and works with no LLM at all; the LLM is
 * an optional grounding layer for prose suggestions (`--explain`).
 *
 * Default: Cloudflare Workers AI (free tier, no credit card, no API key stored
 * in the repo — read from env). Swappable: ollama (local), anthropic (cloud).
 * Falls back to a no-op StubLlmClient when no credentials are present.
 * See ADR-002.
 */

import type { LlmConfig } from "./types.js";

const DEFAULT_WORKERS_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_OLLAMA_MODEL = "llama3.1";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export interface LlmClient {
  complete(prompt: string, system?: string): Promise<string>;
}

/** Deterministic, offline no-op. Used when no provider is configured. */
export class StubLlmClient implements LlmClient {
  async complete(): Promise<string> {
    return "";
  }
}

export class WorkersAiClient implements LlmClient {
  constructor(
    private accountId: string,
    private apiToken: string,
    private model: string = DEFAULT_WORKERS_MODEL,
  ) {}

  async complete(prompt: string, system?: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;
    const messages: Array<{ role: string; content: string }> = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`Workers AI HTTP ${res.status}`);
    const data = (await res.json()) as { result?: { response?: string } };
    return data.result?.response ?? "";
  }
}

export class OllamaClient implements LlmClient {
  constructor(
    private model: string = DEFAULT_OLLAMA_MODEL,
    private host: string = "http://localhost:11434",
  ) {}

  async complete(prompt: string, system?: string): Promise<string> {
    const res = await fetch(`${this.host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: system ? `${system}\n\n${prompt}` : prompt,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return data.response ?? "";
  }
}

export class AnthropicClient implements LlmClient {
  constructor(
    private apiKey: string,
    private model: string = DEFAULT_ANTHROPIC_MODEL,
  ) {}

  async complete(prompt: string, system?: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? "";
  }
}

export function createLlmClient(cfg: LlmConfig): LlmClient {
  switch (cfg.provider) {
    case "workers-ai":
      if (!cfg.accountId || !cfg.apiToken) return new StubLlmClient();
      return new WorkersAiClient(cfg.accountId, cfg.apiToken, cfg.model);
    case "ollama":
      return new OllamaClient(cfg.model);
    case "anthropic":
      if (!cfg.apiToken) return new StubLlmClient();
      return new AnthropicClient(cfg.apiToken, cfg.model);
    default:
      return new StubLlmClient();
  }
}

/**
 * Build an LlmConfig from environment variables. No secrets in the repo.
 *   LUAU_DOCTOR_LLM      = workers-ai | ollama | anthropic | stub  (default workers-ai)
 *   CF_ACCOUNT_ID        = Cloudflare account id   (workers-ai)
 *   CF_API_TOKEN         = Cloudflare API token     (workers-ai)
 *   ANTHROPIC_API_KEY    = Anthropic key            (anthropic)
 *   LUAU_DOCTOR_MODEL    = model override           (any provider)
 */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const provider = (env.LUAU_DOCTOR_LLM as LlmConfig["provider"]) ?? "workers-ai";
  return {
    provider,
    accountId: env.CF_ACCOUNT_ID,
    apiToken:
      provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.CF_API_TOKEN,
    model: env.LUAU_DOCTOR_MODEL,
  };
}
