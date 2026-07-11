import Route from "@ember/routing/route";

export default class MechboxRoute extends Route {
  model() {
    return {
      apiPrefix: "/mechbox/api",
      analysisCategories: [
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
      ],
      singleToolDirectory: [
        {
          id: "shaft_system_chain",
          status: "planned",
        },
        {
          id: "bolt_connection_chain",
          status: "planned",
        },
      ],
      futureInterfaces: [
        "metadata",
        "tools_index",
        "calculate",
        "records_index",
        "favorites_index",
        "templates_index",
        "preferences_show",
      ],
    };
  }
}
