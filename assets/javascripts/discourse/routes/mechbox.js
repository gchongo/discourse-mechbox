import Route from "@ember/routing/route";
import { ajax } from "discourse/lib/ajax";

const ANALYSIS_CATEGORIES = [
  {
    id: "linear_1d",
    tools: ["tooth_backlash", "shaft_bearing_fit", "shaft_runout_tolerance", "gasket_thickness"],
  },
  {
    id: "planar_2d",
    tools: ["parallelism", "perpendicularity", "roundness_2d", "flatness", "straightness"],
  },
  {
    id: "spatial_3d",
    tools: ["solid_assembly", "box_assembly", "frame_assembly", "spatial_stackup"],
  },
  {
    id: "gdt_tolerance",
    tools: ["position", "concentricity", "circularity", "runout", "cylindricity"],
  },
];

export default class MechboxRoute extends Route {
  async model() {
    const metadata = await ajax("/mechbox/api/metadata");

    return {
      metadata,
      analysisCategories: ANALYSIS_CATEGORIES,
    };
  }
}
