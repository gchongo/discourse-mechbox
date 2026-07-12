import Route from "@ember/routing/route";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { i18n } from "discourse-i18n";

export default class MechboxRoute extends Route {
  @service siteSettings;
  @service router;

  beforeModel() {
    if (!this.siteSettings.mechbox_enabled) {
      return this.router.replaceWith("discovery.latest");
    }
  }

  async model() {
    const model = await ajax("/mechbox/api/metadata");
    const toolId = new URLSearchParams(window.location.search).get("tool_id");

    if (toolId) {
      model.selected_tool = await ajax(`/mechbox/api/tools/${toolId}`);
    }

    return model;
  }

  titleToken() {
    return i18n("mechbox.title");
  }
}
