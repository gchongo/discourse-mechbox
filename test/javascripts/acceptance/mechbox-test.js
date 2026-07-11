import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("MechBox | MVP page", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.get("/mechbox/api/metadata", () =>
      helper.response({
        api_version: 1,
        capabilities: {
          metadata: { enabled: true },
          tools: { enabled: true },
          calculate: { enabled: true },
          records_index: { enabled: true },
          favorites: { enabled: true },
        },
        categories: [{ id: "general", name: "General", icon: "calculator", order: 0 }],
        builtin_tools: [
          {
            tool_id: "gear_ratio",
            name: "Gear ratio",
            description: "Calculate speed ratio from tooth counts.",
            category: "transmission",
            implementation: "server_builtin",
            inputs: [],
            outputs: [],
            available: true,
          },
        ],
        client_tools: [],
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

    server.get("/mechbox/api/tools", () =>
      helper.response({
        categories: [{ id: "general", name: "General", icon: "calculator", order: 0 }],
        builtin_tools: [
          {
            tool_id: "gear_ratio",
            name: "Gear ratio",
            description: "Calculate speed ratio from tooth counts.",
            category: "transmission",
            implementation: "server_builtin",
            inputs: [],
            outputs: [],
            available: true,
          },
        ],
        client_tools: [],
      })
    );

    server.get("/mechbox/api/favorites", () => helper.response([]));
    server.get("/mechbox/api/records", () => helper.response({ records: [], meta: {} }));
    server.post("/mechbox/api/calculate", () =>
      helper.response({
        tool_id: "gear_ratio",
        outputs: { ratio: 2.0, output_speed_rpm: 600.0 },
        unit_system: "metric",
        record_id: 123,
      })
    );
  });

  test("renders the MechBox workbench", async function (assert) {
    await visit("/mechbox");

    assert.true(exists(".mechbox__page"), "MVP page is rendered");
    assert.true(exists(".mechbox__tools-panel"), "tools panel is rendered");
    assert.true(exists(".mechbox__workbench-panel"), "workbench panel is rendered");
    assert.true(exists(".mechbox__records-panel"), "records panel is rendered");
  });
});
