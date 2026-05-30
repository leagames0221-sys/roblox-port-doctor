# ADR-003: Pluggable LLM provider, free + no-card default

## Status
Accepted.

## Context
When the optional explanation layer *is* used, it must not violate the project's
standing constraints: free, no credit card required, local-capable, secrets never in the
repo. Different situations want different backends — a quick demo (free cloud), a
confidential client codebase (fully local), or a paid engagement (the client's own key).

## Decision
Define a one-method `LlmClient` interface and select the implementation from
`LLM_PROVIDER`: `workers-ai` (Cloudflare free tier, no card) as default, `ollama`
(local/offline), `anthropic` (paid), and a `stub` fallback. Credentials come only from
environment variables; none are stored in the repo. Switching backend is a one-line env
change — no code change.

## Consequences
- Default path is free and card-free; confidential path (Ollama) is fully offline.
- A missing/misconfigured provider degrades gracefully to deterministic messages rather
  than erroring.
- Four providers is more surface to maintain than one. Accepted — each is ~20 lines and
  they share the interface, and the matrix directly satisfies the constraints.
