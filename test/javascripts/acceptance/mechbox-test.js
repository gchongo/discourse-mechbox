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
        design_chains: [],
        home: {
          available_tools: [
            {
              id: "gear_ratio",
              tool_id: "gear_ratio",
              name: "Gear ratio",
              description: "Calculate speed ratio from tooth counts.",
              available: true,
            },
            {
              id: "bolt_clamp_load",
              tool_id: "bolt_clamp_load",
              name: "Bolt preload",
              description: "Estimate bolt preload from torque.",
              available: true,
            },
          ],
          analysis_groups: [
            {
              id: "linear_1d",
              name: "1D Linear",
              tools: [{ id: "gear_gap", name: "Gear backlash", available: false }],
            },
          ],
          stat_tools: [
            {
              id: "tol_convert",
              name: "Tolerance conversion",
              description: "T ↔ σ",
              available: false,
            },
          ],
          mech_groups: [
            {
              id: "chain",
              name: "Dimension chain and strength",
              tools: [
                {
                  id: "gear_ratio",
                  tool_id: "gear_ratio",
                  name: "Gear ratio",
                  description: "Speed ratio from tooth counts",
                  available: true,
                },
                {
                  id: "bolt_clamp_load",
                  tool_id: "bolt_clamp_load",
                  name: "Bolt preload",
                  description: "Torque ↔ preload",
                  available: true,
                },
              ],
            },
          ],
          counts: { available: 2, catalog: 57 },
        },
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
          { key: "mode", type: "string" },
          { key: "nominal_diameter_mm", type: "number" },
          { key: "pitch_mm", type: "number" },
          { key: "grade", type: "string" },
          { key: "nut_factor", type: "number" },
          { key: "torque_nm", type: "number" },
          { key: "preload_n", type: "number" },
        ],
      });
    });

    server.post("/mechbox/api/calculate", (request) => {
      const body = parsePostData(request.requestBody);

      if (body.tool_id === "bolt_clamp_load") {
        return helper.response(200, {
          tool_id: "bolt_clamp_load",
          outputs: {
            mode: "torque2force",
            grade: "8.8",
            pitch_mm: 1.5,
            preload_n: 25000,
            preload_kn: 25,
            torque_nm: 50,
            stress_area_mm2: 57.99,
            stress_mpa: 431.1,
            allow_stress_mpa: 400,
            max_preload_n: 23196,
            pass: false,
            estimate_only: true,
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
    assert.true(exists(".mechbox__home"), "home is rendered");
    assert.true(exists(".mechbox__home-section"), "home sections are rendered");
    assert.true(exists(".mechbox__home-card--available"), "available tools are rendered");
    assert.true(exists(".mechbox__home-analysis-grid"), "analysis grid is rendered");
  });

  test("opens and calculates on the gear ratio tool page", async function (assert) {
    await visit("/mechbox");
    await click(".mechbox__home-card--available[href*='gear_ratio']");

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
    await waitFor(".mechbox-bolt");
    assert.dom(".mechbox-bolt__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-bolt__results").exists("results column is rendered");
    assert.dom(".mechbox-bolt__mode-tab").exists("calc mode tabs are rendered");
    assert.dom("input[name='torque_nm']").exists("torque input is rendered");
    assert.dom("select[name='grade']").exists("grade select is rendered");

    await fillIn("input[name='torque_nm']", "50");
    await fillIn("input[name='nut_factor']", "0.2");
    await fillIn("input[name='nominal_diameter_mm']", "10");
    await click(".mechbox-bolt__calculate-btn");

    await waitFor(".mechbox-bolt__status");
    assert.dom(".mechbox-bolt__results-body").includesText("25000");
    assert.dom(".mechbox-bolt__status").exists("status badge is rendered");
  });

  test("switches between bolt calc modes", async function (assert) {
    await visit("/mechbox?tool_id=bolt_clamp_load");
    await waitFor(".mechbox-bolt");

    assert.dom("input[name='nut_factor']").exists("simple mode shows nut factor");

    await click(".mechbox-bolt__mode-tab[data-calc-mode='full']");
    assert.dom("input[name='mu_g']").exists("full mode shows mu_g");
    assert
      .dom("[data-calc-show='simple']")
      .hasClass("is-mode-hidden", "simple-only fields are hidden in full mode");

    await click(".mechbox-bolt__mode-tab[data-calc-mode='professional']");
    assert.dom("input[name='grip_length']").exists("professional mode shows grip length");
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

    assert.true(exists(".mechbox__home"), "home is rendered again");
    assert.false(exists(".mechbox__workbench-panel"), "workbench is hidden");
  });
});
