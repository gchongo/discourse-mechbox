import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | safe page", function (needs) {
  needs.user();
  needs.settings({ mechbox_enabled: true, navigation_menu: "sidebar" });
  needs.pretender((server, helper) => {
    server.get("/mechbox/api/metadata", () => {
      return helper.response(200, {
        mode: "phase0_5_7",
        builtin_tools: [
          {
            tool_id: "gear_ratio",
            name: "Gear ratio",
            description: "Calculate speed ratio from tooth counts.",
          },
        ],
        design_chains: [
          {
            tool_id: "shaft_system_chain",
            name: "Shaft system chain",
            description: "Shaft, bearing, and key linkage.",
          },
        ],
      });
    });
  });

  test("sidebar shows the MechBox community link", async function (assert) {
    await visit("/");

    await click(".sidebar-more-section-links-details-summary");

    assert.true(
      exists(".sidebar-section-link[data-link-name='mechbox']"),
      "sidebar link is rendered"
    );
  });

  test("renders the MechBox tool catalog", async function (assert) {
    await visit("/mechbox");

    assert.true(exists(".mechbox__page"), "page is rendered");
    assert.true(exists(".mechbox__catalog-grid"), "catalog is rendered");
    assert.true(exists(".mechbox__tool-list li"), "tools are rendered");
  });
});
