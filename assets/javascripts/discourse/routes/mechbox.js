import Route from "@ember/routing/route";

export default class MechboxRoute extends Route {
  model() {
    return {
      apiPrefix: "/mechbox/api",
      futureInterfaces: [
        "metadata",
        "tools_index",
        "calculate",
        "records_index",
        "favorites_index",
        "templates_index",
        "preferences_show",
        "projects_index",
      ],
    };
  }
}
