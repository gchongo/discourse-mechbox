// Registry for browser-side MechBox calculators ported from MechBox/src/utils/.
//
// To enable a client tool:
// 1. Add a module here keyed by tool_id.
// 2. Add tool_id to ToolCatalog::ENABLED_CLIENT_TOOL_IDS (Ruby).
// 3. Set ApiCapabilities client_tools.enabled = true.
// 4. Wire ClientToolsController routes in config/routes.rb.
//
// Example:
// import { calculateGear } from "./gear";
// export const CLIENT_TOOL_CALCULATORS = {
//   gear: calculateGear,
// };

export const CLIENT_TOOL_CALCULATORS = {};

export function clientToolCalculator(toolId) {
  return CLIENT_TOOL_CALCULATORS[toolId] ?? null;
}
