import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | safe page", function (needs) {
  needs.user();
  needs.settings({ mechbox_enabled: true });

  test("renders the MechBox placeholder page", async function (assert) {
    await visit("/mechbox");

    assert.true(exists(".mechbox__page"), "page is rendered");
    assert.true(exists(".mechbox__workbench-panel"), "workbench panel is rendered");
  });
});
