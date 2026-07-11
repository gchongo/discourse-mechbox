import Route from "@ember/routing/route";

export default class MechboxRoute extends Route {
  model() {
    return {
      apiPrefix: "/mechbox/api",
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
