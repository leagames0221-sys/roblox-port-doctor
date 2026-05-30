/**
 * Pack registry. Adding a new domain = adding a Pack here; the core engine is
 * untouched. See ADR-004.
 */

import type { Pack, Rule } from "../core/types.js";
import { robloxPack } from "./roblox/index.js";
import { ue5PortPack } from "./ue5-port/index.js";

export const PACKS: Record<string, Pack> = {
  roblox: robloxPack,
  "ue5-port": ue5PortPack,
};

export const DEFAULT_PACKS = ["roblox"];

/** Resolve pack names to a flat, deduplicated rule list. Unknown names throw. */
export function collectRules(packNames: string[]): Rule[] {
  const seen = new Set<string>();
  const rules: Rule[] = [];
  for (const name of packNames) {
    const pack = PACKS[name];
    if (!pack) {
      throw new Error(
        `Unknown pack "${name}". Available: ${Object.keys(PACKS).join(", ")}`,
      );
    }
    for (const r of pack.rules) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rules.push(r);
    }
  }
  return rules;
}
