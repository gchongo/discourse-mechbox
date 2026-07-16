import Route from "@ember/routing/route";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { i18n } from "discourse-i18n";

export default class MechboxRoute extends Route {
  @service siteSettings;
  @service router;

  queryParams = {
    tool_id: { refreshModel: true },
  };

  beforeModel() {
    if (!this.siteSettings.mechbox_enabled) {
      return this.router.replaceWith("discovery.latest");
    }
  }

  async model(params) {
    const model = await ajax("/mechbox/api/metadata");
    const toolId =
      params?.tool_id || new URLSearchParams(window.location.search).get("tool_id");

    if (toolId) {
      try {
        model.selected_tool = await ajax(
          `/mechbox/api/tools/${encodeURIComponent(toolId)}`
        );
      } catch {
        model.selected_tool = null;
      }
    } else {
      model.selected_tool = null;
    }

    return model;
  }

  titleToken(model) {
    return model?.selected_tool?.name || i18n("mechbox.title");
  }
}
