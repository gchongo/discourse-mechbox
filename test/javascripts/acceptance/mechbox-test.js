import { click, fillIn, visit, waitFor } from "@ember/test-helpers";
import { test } from "qunit";
import { parsePostData } from "discourse/tests/helpers/create-pretender";
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
            tool_id: "bolt_clamp_load",
            name: "Bolt preload",
            description: "Estimate bolt preload from torque.",
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

    server.get("/mechbox/api/tools/bolt_clamp_load", () => {
      return helper.response(200, {
        tool_id: "bolt_clamp_load",
        name: "Bolt preload",
        description: "Estimate bolt preload from torque.",
        available: true,
        inputs: [
          { key: "torque_nm", type: "number" },
          { key: "nut_factor", type: "number" },
          { key: "nominal_diameter_mm", type: "number" },
        ],
      });
    });

    server.post("/mechbox/api/calculate", (request) => {
      const body = parsePostData(request.requestBody);

      if (body.tool_id === "bolt_clamp_load") {
        return helper.response(200, {
          tool_id: "bolt_clamp_load",
          outputs: {
            preload_n: 25000,
            preload_kn: 25,
            torque_nm: 50,
          },
        });
      }

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
    await click(".mechbox__tool-link[href*='gear_ratio']");

    assert.true(exists(".mechbox__page"), "page is rendered");
    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");
    await waitFor("input[name='driver_teeth']");

    await fillIn("input[name='driver_teeth']", "20");
    await fillIn("input[name='driven_teeth']", "40");
    await fillIn("input[name='input_speed_rpm']", "1000");
    await click(".mechbox__actions .btn");

    assert.dom(".mechbox__result").includesText("output_speed_rpm");
  });

  test("opens and calculates on the bolt preload tool page", async function (assert) {
    await visit("/mechbox?tool_id=bolt_clamp_load");

    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");
    await waitFor("input[name='torque_nm']");
    assert.dom("input[name='nut_factor']").exists("nut factor input is rendered");

    await fillIn("input[name='torque_nm']", "50");
    await fillIn("input[name='nut_factor']", "0.2");
    await fillIn("input[name='nominal_diameter_mm']", "10");
    await click(".mechbox__actions .btn");

    assert.dom(".mechbox__result").includesText("preload_n");
  });

  test("renders the gear ratio tool page on direct visit", async function (assert) {
    await visit("/mechbox?tool_id=gear_ratio");

    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");
    await waitFor("input[name='driver_teeth']");
    assert.dom("input[name='driven_teeth']").exists("driven teeth input is rendered");
    assert.dom("input[name='input_speed_rpm']").exists("input speed input is rendered");
  });

  test("returns to the catalog from a tool page", async function (assert) {
    await visit("/mechbox?tool_id=gear_ratio");

    assert.true(exists(".mechbox__workbench-panel"), "workbench is rendered");

    await click(".mechbox__back-link");

    assert.true(exists(".mechbox__catalog-grid"), "catalog is rendered again");
    assert.false(exists(".mechbox__workbench-panel"), "workbench is hidden");
  });
});
