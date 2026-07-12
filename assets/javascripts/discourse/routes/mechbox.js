import Route from "@ember/routing/route";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { i18n } from "discourse-i18n";

export default class MechboxRoute extends Route {
  @service siteSettings;
  @service router;

  queryParams = {
    tool_id: {
      refreshModel: true,
    },
  };

  beforeModel() {
    if (!this.siteSettings.mechbox_enabled) {
      return this.router.replaceWith("discovery.latest");
    }
  }

  async model(params) {
    const model = await ajax("/mechbox/api/metadata");

    if (params.tool_id) {
      model.selected_tool = await ajax(`/mechbox/api/tools/${params.tool_id}`);
    }

    return model;
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.inputValues = {};
    controller.result = null;
    controller.isCalculating = false;
    controller.errorMessage = null;
  }

  titleToken(model) {
    return model?.selected_tool?.name || i18n("mechbox.title");
  }
}
