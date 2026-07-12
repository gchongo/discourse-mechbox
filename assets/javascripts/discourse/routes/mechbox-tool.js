import Route from "@ember/routing/route";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { i18n } from "discourse-i18n";

export default class MechboxToolRoute extends Route {
  @service siteSettings;
  @service router;

  beforeModel() {
    if (!this.siteSettings.mechbox_enabled) {
      return this.router.replaceWith("discovery.latest");
    }
  }

  model(params) {
    return ajax(`/mechbox/api/tools/${params.tool_id}`);
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.inputValues = {};
    controller.result = null;
    controller.isCalculating = false;
    controller.errorMessage = null;
  }

  titleToken(model) {
    return model?.name || i18n("mechbox.title");
  }
}
