import { withPluginApi } from "discourse/lib/plugin-api";
import { i18n } from "discourse-i18n";

export default {
  name: "discourse-mechbox-navigation",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.mechbox_enabled) {
      return;
    }

    withPluginApi("0.8.7", (api) => {
      if (typeof api.addCommunitySectionLink !== "function") {
        return;
      }

      api.addCommunitySectionLink({
        name: "mechbox",
        route: "mechbox",
        title: i18n("mechbox.nav_title"),
        text: i18n("mechbox.nav_title"),
        icon: "calculator",
      });
    });
  },
};
