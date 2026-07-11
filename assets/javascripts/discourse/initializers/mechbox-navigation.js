import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";

export default {
  name: "discourse-mechbox-navigation",

  initialize() {
    withPluginApi("0.8.7", (api) => {
      const title = I18n.t("mechbox.nav_title");

      if (typeof api.addCommunitySectionLink === "function") {
        api.addCommunitySectionLink({
          name: "mechbox",
          route: "mechbox",
          title,
          text: title,
          icon: "calculator",
        });
      }
    });
  },
};
