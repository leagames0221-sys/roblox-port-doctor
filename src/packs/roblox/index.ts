import type { Pack } from "../../core/types.js";
import { ROBLOX_RULES } from "./rules.js";

export const robloxPack: Pack = {
  name: "roblox",
  description:
    "General-purpose Roblox/Luau bug, security and performance rules (default).",
  rules: ROBLOX_RULES,
};
