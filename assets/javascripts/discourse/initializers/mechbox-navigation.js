import { withPluginApi } from "discourse/lib/plugin-api";
import { i18n } from "discourse-i18n";

export default {
  name: "discourse-mechbox-navigation",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.mechbox_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.addCommunitySectionLink((BaseSectionLink) => {
        return class MechboxSectionLink extends BaseSectionLink {
          name = "mechbox";
          route = "mechbox";
          title = i18n("mechbox.nav_title");
          text = i18n("mechbox.nav_title");
          defaultPrefixValue = "calculator";
        };
      });
    });
  },
};
