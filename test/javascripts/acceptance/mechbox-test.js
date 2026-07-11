import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | safe page", function (needs) {
  needs.user();
  needs.settings({ mechbox_enabled: true, navigation_menu: "sidebar" });

  test("sidebar shows the MechBox community link", async function (assert) {
    await visit("/");

    await click(".sidebar-more-section-links-details-summary");

    assert.true(
      exists(".sidebar-section-link[data-link-name='mechbox']"),
      "sidebar link is rendered"
    );
  });

  test("renders the MechBox placeholder page", async function (assert) {
    await visit("/mechbox");

    assert.true(exists(".mechbox__page"), "page is rendered");
    assert.true(exists(".mechbox__workbench-panel"), "workbench panel is rendered");
  });
});
