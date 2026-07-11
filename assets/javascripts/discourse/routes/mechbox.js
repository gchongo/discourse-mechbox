import Route from "@ember/routing/route";
import { service } from "@ember/service";
import { i18n } from "discourse-i18n";

export default class MechboxRoute extends Route {
  @service siteSettings;
  @service router;

  beforeModel() {
    if (!this.siteSettings.mechbox_enabled) {
      return this.router.replaceWith("discovery.latest");
    }
  }

  titleToken() {
    return i18n("mechbox.title");
  }
}
