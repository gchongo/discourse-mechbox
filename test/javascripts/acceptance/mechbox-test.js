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
          available_tools: [],
          analysis_groups: [
            {
              id: "linear_1d",
              name: "1D Linear",
              icon: "ruler-combined",
              tools: [
                {
                  id: "gear_gap",
                  name: "Gear backlash",
                  icon: "gear",
                  available: false,
                },
              ],
            },
          ],
          stat_tools: [
            {
              id: "rss_calculation",
              tool_id: "rss_calculation",
              name: "RSS calculation",
              description: "Basic RSS",
              icon: "chart-column",
              available: true,
            },
            {
              id: "tol_convert",
              name: "Tolerance conversion",
              description: "T ↔ σ",
              icon: "arrows-left-right",
              available: false,
            },
          ],
          mech_groups: [
            {
              id: "chain",
              name: "Dimension chain and strength",
              tools: [
                {
                  id: "unit_converter",
                  tool_id: "unit_converter",
                  name: "Unit conversion",
                  description: "MPa/psi · mm/in",
                  icon: "arrows-left-right",
                  available: true,
                },
                {
                  id: "gear_ratio",
                  tool_id: "gear_ratio",
                  name: "Gear ratio",
                  description: "Speed ratio from tooth counts",
                  icon: "gear",
                  available: true,
                },
                {
                  id: "bolt_clamp_load",
                  tool_id: "bolt_clamp_load",
                  name: "Bolt preload",
                  description: "Torque ↔ preload",
                  icon: "bolt",
                  available: true,
                },
                {
                  id: "thread",
                  tool_id: "thread",
                  name: "Thread strength",
                  description: "Tensile/shear stress",
                  icon: "link",
                  available: true,
                },
                {
                  id: "key",
                  tool_id: "key",
                  name: "Key connection",
                  description: "Crush and shear",
                  icon: "key",
                  available: true,
                },
                {
                  id: "bolt_group",
                  tool_id: "bolt_group",
                  name: "Bolt group",
                  description: "Eccentric load sharing",
                  icon: "table-cells",
                  available: true,
                },
                {
                  id: "weld",
                  tool_id: "weld",
                  name: "Weld strength",
                  description: "Fillet / butt weld",
                  icon: "medal",
                  available: true,
                },
              ],
            },
          ],
          counts: { available: 8, catalog: 57 },
        },
      });
    });

    server.get("/mechbox/api/tools/thread", () => {
      return helper.response(200, {
        tool_id: "thread",
        name: "Thread strength",
        description: "Tensile and shear check.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "diameter_mm", type: "number" },
          { key: "pitch_mm", type: "number" },
          { key: "grade", type: "string" },
          { key: "axial_force_n", type: "number" },
          { key: "engaged_length_mm", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/key", () => {
      return helper.response(200, {
        tool_id: "key",
        name: "Key connection",
        description: "GB/T 1096 crush and shear check.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "torque_nm", type: "number" },
          { key: "shaft_diameter_mm", type: "number" },
          { key: "key_width_mm", type: "number" },
          { key: "key_height_mm", type: "number" },
          { key: "key_length_mm", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/bolt_group", () => {
      return helper.response(200, {
        tool_id: "bolt_group",
        name: "Bolt group",
        description: "Eccentric shear and moment load sharing.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "bolt_count", type: "number" },
          { key: "bolt_circle_radius_mm", type: "number" },
          { key: "shear_x_n", type: "number" },
          { key: "shear_y_n", type: "number" },
          { key: "moment_nmm", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/weld", () => {
      return helper.response(200, {
        tool_id: "weld",
        name: "Weld strength",
        description: "Fillet and butt weld estimates.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "weld_type", type: "string" },
          { key: "leg_size_mm", type: "number" },
          { key: "weld_length_mm", type: "number" },
          { key: "force_n", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/unit_converter", () => {
      return helper.response(200, {
        tool_id: "unit_converter",
        name: "Unit converter",
        description: "Convert engineering units.",
        available: true,
        inputs: [
          { key: "value", type: "number" },
          { key: "from_unit", type: "string" },
          { key: "to_unit", type: "string" },
        ],
      });
    });

    server.get("/mechbox/api/tools/rss_calculation", () => {
      return helper.response(200, {
        tool_id: "rss_calculation",
        name: "RSS calculation",
        description: "Root sum square.",
        available: true,
        inputs: [{ key: "values", type: "number_array" }],
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

      if (body.tool_id === "unit_converter") {
        return helper.response(200, {
          tool_id: "unit_converter",
          outputs: {
            converted_value: 25.4,
            from_unit: "in",
            to_unit: "mm",
          },
        });
      }

      if (body.tool_id === "rss_calculation") {
        return helper.response(200, {
          tool_id: "rss_calculation",
          outputs: {
            rss: 5,
            count: 2,
          },
        });
      }

      if (body.tool_id === "thread") {
        return helper.response(200, {
          tool_id: "thread",
          outputs: {
            calc_mode: "simple",
            stress_area_mm2: 58.0,
            pitch_diameter_mm: 9.026,
            minor_diameter_mm: 8.376,
            tensile_stress_mpa: 344.8,
            shear_stress_mpa: 120.0,
            tightening_torque_nm: 40,
            torque_method: "simple_mu_d_f",
            max_allowable_force_n: 23200,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "key") {
        return helper.response(200, {
          tool_id: "key",
          outputs: {
            calc_mode: "simple",
            tangential_force_n: 13333.333,
            key_width_mm: 8,
            key_height_mm: 7,
            key_length_mm: 28,
            shear_stress_mpa: 59.524,
            crush_stress_mpa: 136.054,
            allow_shear_mpa: 100,
            allow_crush_mpa: 150,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "bolt_group") {
        return helper.response(200, {
          tool_id: "bolt_group",
          outputs: {
            calc_mode: "simple",
            direct_per_bolt_n: 673.145,
            torsion_per_bolt_n: 250,
            max_bolt_force_n: 923.145,
            allow_per_bolt_n: 8000,
            force_pass: true,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "weld") {
        return helper.response(200, {
          tool_id: "weld",
          outputs: {
            calc_mode: "simple",
            weld_type: "fillet",
            throat_mm: 4.2,
            shear_stress_mpa: 59.524,
            allowable_shear_mpa: 160,
            shear_pass: true,
            estimate_only: true,
            pass: false,
            standards: [
              {
                id: "gb",
                standard: "GB/T 985 (simplified)",
                allowable_shear_mpa: 160,
                pass: true,
              },
            ],
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
    assert.true(exists(".mechbox__home-icon"), "tool icons are rendered");
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

  test("opens and converts on the unit converter page", async function (assert) {
    await visit("/mechbox?tool_id=unit_converter");

    await waitFor(".mechbox-units");
    assert.dom("input[name='value']").exists("value input is rendered");
    assert.dom("select[name='from_unit']").exists("from unit select is rendered");

    await fillIn("input[name='value']", "1");
    await click(".mechbox-units__calculate-btn");
    await waitFor(".mechbox-units__hero-to");

    assert.dom(".mechbox-units__hero-to").includesText("25.4");
  });

  test("opens and calculates on the rss page", async function (assert) {
    await visit("/mechbox?tool_id=rss_calculation");

    await waitFor(".mechbox-rss");
    assert.dom("textarea[name='values']").exists("values textarea is rendered");

    await fillIn("textarea[name='values']", "3\n4");
    await click(".mechbox-rss__calculate-btn");
    await waitFor(".mechbox-rss__dl");

    assert.dom(".mechbox-rss__dl").includesText("5");
  });

  test("opens and calculates on the thread strength page", async function (assert) {
    await visit("/mechbox?tool_id=thread");

    await waitFor(".mechbox-thread");
    assert.dom(".mechbox-thread__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-thread__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='diameter_mm']").exists("diameter input is rendered");
    assert.dom(".mechbox-thread__mode-tab").exists("mode tabs are rendered");
    assert.dom(".mechbox-thread__formula-box").doesNotExist("result formula box removed");

    await fillIn("input[name='axial_force_n']", "20000");
    await click(".mechbox-thread__calculate-btn");
    await waitFor(".mechbox-thread__status");

    assert.dom(".mechbox-thread__status").hasClass("is-attention");
    assert.dom(".mechbox-thread__results-body").includesText("40");

    await click(".mechbox-thread__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows nut material");
  });

  test("opens and calculates on the key connection page", async function (assert) {
    await visit("/mechbox?tool_id=key");

    await waitFor(".mechbox-key");
    assert.dom(".mechbox-key__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-key__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='torque_nm']").exists("torque input is rendered");
    assert.dom(".mechbox-key__mode-tab").exists("mode tabs are rendered");
    assert.dom(".mechbox-key__formula-box").doesNotExist("result formula box removed");

    await fillIn("input[name='torque_nm']", "200");
    await click(".mechbox-key__calculate-btn");
    await waitFor(".mechbox-key__status");

    assert.dom(".mechbox-key__status").hasClass("is-attention");
    assert.dom(".mechbox-key__results-body").includesText("59.5");

    await click(".mechbox-key__mode-tab[data-calc-mode='professional']");
    assert
      .dom("[data-calc-show='professional']")
      .doesNotHaveClass("is-mode-hidden", "professional mode shows key count");
  });

  test("opens and calculates on the bolt group page", async function (assert) {
    await visit("/mechbox?tool_id=bolt_group");

    await waitFor(".mechbox-bolt-group");
    assert.dom(".mechbox-bolt-group__grid").exists("two-column grid is rendered");
    assert
      .dom(".mechbox-bolt-group__formula-bar")
      .exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='bolt_count']").exists("bolt count input is rendered");
    assert.dom(".mechbox-bolt-group__mode-tab").exists("mode tabs are rendered");
    assert
      .dom(".mechbox-bolt-group__formula-box")
      .doesNotExist("result formula box removed");

    await fillIn("input[name='shear_x_n']", "5000");
    await click(".mechbox-bolt-group__calculate-btn");
    await waitFor(".mechbox-bolt-group__status");

    assert.dom(".mechbox-bolt-group__status").hasClass("is-attention");
    assert.dom(".mechbox-bolt-group__results-body").includesText("923");

    await click(".mechbox-bolt-group__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows friction fields");
  });

  test("opens and calculates on the weld strength page", async function (assert) {
    await visit("/mechbox?tool_id=weld");

    await waitFor(".mechbox-weld");
    assert.dom(".mechbox-weld__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-weld__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='leg_size_mm']").exists("leg size input is rendered");
    assert.dom(".mechbox-weld__mode-tab").exists("mode tabs are rendered");
    assert.dom(".mechbox-weld__formula-box").doesNotExist("result formula box removed");

    await fillIn("input[name='force_n']", "20000");
    await click(".mechbox-weld__calculate-btn");
    await waitFor(".mechbox-weld__status");

    assert.dom(".mechbox-weld__status").hasClass("is-attention");
    assert.dom(".mechbox-weld__results-body").includesText("59.5");

    await click(".mechbox-weld__type-tab[data-weld-type='butt']");
    assert
      .dom("[data-weld-show='butt']")
      .doesNotHaveClass("is-mode-hidden", "butt mode shows thickness");
  });
});
