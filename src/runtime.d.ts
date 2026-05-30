/**
 * Minimal ambient declarations for the handful of Node / Fetch globals the CLI
 * and LLM client touch.
 *
 * Deliberate choice (see ADR-005): the project ships ZERO runtime dependencies
 * and we keep build-time deps minimal too — rather than pull the large
 * `@types/node` package just for `process`, `console`, `fetch` and one `fs`
 * function, we declare exactly what we use. `tsconfig` sets `"types": []` so no
 * ambient `@types/*` are auto-included; these shims are the single source.
 */

declare module "node:fs" {
  // path may be a file path or a file descriptor (0 = stdin).
  export function readFileSync(path: string | number, encoding: "utf8"): string;
}

interface ReadableStdin {
  on(event: "data", cb: (chunk: string) => void): void;
  on(event: "end", cb: () => void): void;
  setEncoding(encoding: "utf8"): void;
  resume(): void;
}

interface WritableStd {
  write(s: string): void;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  stdin: ReadableStdin;
  stdout: WritableStd;
  stderr: WritableStd;
};

declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare namespace NodeJS {
  type ProcessEnv = Record<string, string | undefined>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<FetchResponse>;
