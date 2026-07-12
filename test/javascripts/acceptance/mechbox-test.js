import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | safe page", function (needs) {
  needs.user();
  needs.settings({ mechbox_enabled: true, navigation_menu: "sidebar" });
  needs.pretender((server, helper) => {
    server.get("/mechbox/api/metadata", () => {
      return helper.response(200, {
        mode: "phase1_3",
        capabilities: {
          calculate: { enabled: true },
        },
        preferences: {
          unit_system: null,
          favorite_layout: "grid",
          recent_tool_ids: [],
        },
        builtin_tools: [
          {
            tool_id: "gear_ratio",
            name: "Gear ratio",
            description: "Calculate speed ratio from tooth counts.",
            available: true,
          },
          {
            tool_id: "unit_converter",
            name: "Unit converter",
            description: "Convert engineering units.",
            available: false,
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

    server.get("/mechbox/api/tools/gear_ratio", () => {
      return helper.response(200, {
        tool_id: "gear_ratio",
        name: "Gear ratio",
        description: "Calculate speed ratio from tooth counts.",
        available: true,
        inputs: [
          { key: "driver_teeth", type: "integer" },
          { key: "driven_teeth", type: "integer" },
          { key: "input_speed_rpm", type: "number" },
        ],
      });
    });

    server.post("/mechbox/api/calculate", () => {
      return helper.response(200, {
        tool_id: "gear_ratio",
        outputs: {
          ratio: 2,
          output_speed_rpm: 500,
        },
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

  test("opens and calculates on the gear ratio tool page", async function (assert) {
    await visit("/mechbox");
    await click(".mechbox__tool-link");

    assert.true(exists(".mechbox__page"), "page is rendered");
    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");
    assert.dom("input[name='driver_teeth']").exists("driver teeth input is rendered");

    await fillIn("input[name='driver_teeth']", "20");
    await fillIn("input[name='driven_teeth']", "40");
    await fillIn("input[name='input_speed_rpm']", "1000");
    await click(".mechbox__actions button");

    assert.dom(".mechbox__result").includesText("output_speed_rpm");
  });

  test("returns to the catalog from a tool page", async function (assert) {
    await visit("/mechbox?tool_id=gear_ratio");

    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");

    await click(".mechbox__back-link");

    assert.true(exists(".mechbox__catalog-grid"), "catalog is rendered again");
    assert.false(exists(".mechbox__workbench-panel"), "workbench is hidden");
  });
});
