import Route from "@ember/routing/route";
import { ajax } from "discourse/lib/ajax";
import { service } from "@ember/service";

export default class MechboxToolRoute extends Route {
  @service router;

  async model(params) {
    try {
      return await ajax(`/mechbox/api/tools/${encodeURIComponent(params.tool_id)}`);
    } catch (error) {
      if (error?.jqXHR?.status === 404) {
        return this.router.replaceWith("mechbox.index");
      }

      throw error;
    }
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.resetFromTool(model);
  }
}
