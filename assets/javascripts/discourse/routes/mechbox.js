import Route from "@ember/routing/route";
import { ajax } from "discourse/lib/ajax";

export default class MechboxRoute extends Route {
  async model() {
    const [metadata, toolsPayload, recordsPayload, favoritesPayload] = await Promise.all([
      ajax("/mechbox/api/metadata"),
      ajax("/mechbox/api/tools"),
      ajax("/mechbox/api/records", { data: { limit: 20 } }),
      ajax("/mechbox/api/favorites"),
    ]);

    return {
      metadata,
      categories: toolsPayload.categories || metadata.categories || [],
      builtinTools: toolsPayload.builtin_tools || metadata.builtin_tools || [],
      clientTools: toolsPayload.client_tools || metadata.client_tools || [],
      records: recordsPayload.records || [],
      favorites: favoritesPayload || [],
    };
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.initializeFromModel(model);
  }
}
