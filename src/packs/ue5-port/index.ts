import type { Pack } from "../../core/types.js";
import { UE5_PORT_RULES } from "./rules.js";

export const ue5PortPack: Pack = {
  name: "ue5-port",
  description:
    "C++/Blueprint -> Luau migration pitfalls (off by default; enable when porting UE5 logic to Roblox).",
  rules: UE5_PORT_RULES,
};
