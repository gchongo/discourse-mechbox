import { visit, click, fillIn } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | incremental page", function (needs) {
  needs.user();
  needs.settings({ mechbox_enabled: true });
  needs.pretender((server, helper) => {
    server.get("/mechbox/api/metadata", () =>
      helper.response({
        api_version: 1,
        capabilities: {
          metadata: { enabled: true },
          tools: { enabled: true },
          calculate: { enabled: true },
        },
        categories: [{ id: "transmission", name: "Transmission", icon: "gear", order: 20 }],
        builtin_tools: [
          {
            tool_id: "gear_ratio",
            name: "Gear ratio",
            description: "Calculate speed ratio from tooth counts.",
            category: "transmission",
            implementation: "server_builtin",
            inputs: [
              { key: "driver_teeth", type: "number", required: true },
              { key: "driven_teeth", type: "number", required: true },
              { key: "input_speed_rpm", type: "number", required: true },
            ],
            outputs: [
              { key: "ratio", type: "number" },
              { key: "output_speed_rpm", type: "number" },
            ],
            available: true,
          },
        ],
        client_tools: [],
        design_chains: [
          {
            tool_id: "shaft_system_chain",
            name: "Shaft system chain",
            description: "Deferred design chain.",
            status: "deferred",
            available: false,
          },
        ],
        formula_templates: [],
        favorite_tool_ids: [],
        preferences: { recent_tool_ids: [] },
        settings: {
          save_calculation_records: true,
          max_records_per_user: 500,
          default_unit_system: "metric",
          can_manage_templates: false,
        },
      })
    );

    server.get("/mechbox/api/tools/gear_ratio", () =>
      helper.response({
        tool_id: "gear_ratio",
        name: "Gear ratio",
        description: "Calculate speed ratio from tooth counts.",
        category: "transmission",
        implementation: "server_builtin",
        inputs: [
          { key: "driver_teeth", type: "number", required: true },
          { key: "driven_teeth", type: "number", required: true },
          { key: "input_speed_rpm", type: "number", required: true },
        ],
        outputs: [
          { key: "ratio", type: "number" },
          { key: "output_speed_rpm", type: "number" },
        ],
        available: true,
        formula_templates: [],
      })
    );

    server.post("/mechbox/api/calculate", () =>
      helper.response({
        tool_id: "gear_ratio",
        outputs: { ratio: 2.0, output_speed_rpm: 600.0 },
        unit_system: "metric",
        record_id: null,
      })
    );
  });

  test("renders the MechBox home page with builtin tools", async function (assert) {
    await visit("/mechbox");

    assert.true(exists(".mechbox__page"), "home page is rendered");
    assert.true(exists(".mechbox__tool-list"), "builtin tools list is rendered");
    assert.true(exists(".mechbox__catalog-card--deferred"), "deferred design chains are shown");
  });

  test("runs gear_ratio from the tool page", async function (assert) {
    await visit("/mechbox/tools/gear_ratio");

    assert.true(exists(".mechbox__workbench-panel"), "tool page is rendered");

    await fillIn("#mechbox-input-driver_teeth", "20");
    await fillIn("#mechbox-input-driven_teeth", "40");
    await fillIn("#mechbox-input-input_speed_rpm", "1200");
    await click(".mechbox__actions .btn-primary");

    assert.true(exists(".mechbox__result"), "calculation result is rendered");
  });
});
