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
              tool_id: "tol_convert",
              name: "Tolerance conversion",
              description: "T ↔ σ",
              icon: "arrows-left-right",
              available: true,
            },
            {
              id: "sigma_analysis",
              tool_id: "sigma_analysis",
              name: "Sigma analysis",
              description: "C / Cpk",
              icon: "chart-line",
              available: true,
            },
            {
              id: "distribution_chart",
              tool_id: "distribution_chart",
              name: "Distribution chart",
              description: "PDF samples",
              icon: "chart-pie",
              available: true,
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
                {
                  id: "spring",
                  tool_id: "spring",
                  name: "Spring design",
                  description: "Rate and shear",
                  icon: "rotate",
                  available: true,
                },
                {
                  id: "clutch",
                  tool_id: "clutch",
                  name: "Clutch",
                  description: "Friction torque",
                  icon: "share-nodes",
                  available: true,
                },
                {
                  id: "belt",
                  tool_id: "belt",
                  name: "Belt drive",
                  description: "Length and tension",
                  icon: "minus",
                  available: true,
                },
                {
                  id: "chain",
                  tool_id: "chain",
                  name: "Chain drive",
                  description: "Pitch and tension",
                  icon: "link",
                  available: true,
                },
                {
                  id: "fit",
                  tool_id: "fit",
                  name: "ISO 286 fit",
                  description: "Hole/shaft fit",
                  icon: "scale-balanced",
                  available: true,
                },
                {
                  id: "thermal_expansion",
                  tool_id: "thermal_expansion",
                  name: "Thermal expansion",
                  description: "Linear growth and fit",
                  icon: "sun",
                  available: true,
                },
                {
                  id: "interference_fit",
                  tool_id: "interference_fit",
                  name: "Interference fit",
                  description: "Press-fit pressure",
                  icon: "coins",
                  available: true,
                },
                {
                  id: "bearing",
                  tool_id: "bearing",
                  name: "Bearing life",
                  description: "ISO 281 L10",
                  icon: "circle-question",
                  available: true,
                },
              ],
            },
          ],
          counts: { available: 19, catalog: 57 },
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

    server.get("/mechbox/api/tools/spring", () => {
      return helper.response(200, {
        tool_id: "spring",
        name: "Spring design",
        description: "Helical compression spring.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "wire_diameter_mm", type: "number" },
          { key: "mean_diameter_mm", type: "number" },
          { key: "active_coils", type: "number" },
          { key: "load_n", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/clutch", () => {
      return helper.response(200, {
        tool_id: "clutch",
        name: "Clutch",
        description: "Friction clutch torque.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "friction_coeff", type: "number" },
          { key: "force_n", type: "number" },
          { key: "radius_mm", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/belt", () => {
      return helper.response(200, {
        tool_id: "belt",
        name: "Belt drive",
        description: "Open belt length and tension.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "driver_diameter_mm", type: "number" },
          { key: "driven_diameter_mm", type: "number" },
          { key: "center_distance_mm", type: "number" },
          { key: "power_kw", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/chain", () => {
      return helper.response(200, {
        tool_id: "chain",
        name: "Chain drive",
        description: "Roller chain pitch and tension.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "pitch_mm", type: "number" },
          { key: "driver_teeth", type: "number" },
          { key: "driven_teeth", type: "number" },
          { key: "center_distance_mm", type: "number" },
          { key: "power_kw", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/tol_convert", () => {
      return helper.response(200, {
        tool_id: "tol_convert",
        name: "Tolerance conversion",
        description: "T ↔ σ conversion.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "direction", type: "string" },
          { key: "value", type: "number" },
          { key: "distribution", type: "string" },
        ],
      });
    });

    server.get("/mechbox/api/tools/sigma_analysis", () => {
      return helper.response(200, {
        tool_id: "sigma_analysis",
        name: "Sigma analysis",
        description: "Process capability C / Cpk.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "lsl", type: "number" },
          { key: "usl", type: "number" },
          { key: "mean", type: "number" },
          { key: "sigma", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/fit", () => {
      return helper.response(200, {
        tool_id: "fit",
        name: "ISO 286 fit",
        description: "Hole/shaft fit.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "nominal_mm", type: "number" },
          { key: "hole_code", type: "string" },
          { key: "shaft_code", type: "string" },
        ],
      });
    });

    server.get("/mechbox/api/tools/distribution_chart", () => {
      return helper.response(200, {
        tool_id: "distribution_chart",
        name: "Distribution chart",
        description: "PDF peak density and samples.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "tolerance", type: "number" },
          { key: "distribution", type: "string" },
        ],
      });
    });

    server.get("/mechbox/api/tools/thermal_expansion", () => {
      return helper.response(200, {
        tool_id: "thermal_expansion",
        name: "Thermal expansion",
        description: "Linear growth and fit change.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "material", type: "string" },
          { key: "length_mm", type: "number" },
          { key: "delta_t", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/interference_fit", () => {
      return helper.response(200, {
        tool_id: "interference_fit",
        name: "Interference fit",
        description: "Press-fit contact pressure.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "shaft_diameter_mm", type: "number" },
          { key: "hole_diameter_mm", type: "number" },
          { key: "hub_outer_diameter_mm", type: "number" },
        ],
      });
    });

    server.get("/mechbox/api/tools/bearing", () => {
      return helper.response(200, {
        tool_id: "bearing",
        name: "Bearing life",
        description: "ISO 281 L10 life.",
        available: true,
        inputs: [
          { key: "calc_mode", type: "string" },
          { key: "dynamic_load_n", type: "number" },
          { key: "radial_load_n", type: "number" },
          { key: "rpm", type: "number" },
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

      if (body.tool_id === "spring") {
        return helper.response(200, {
          tool_id: "spring",
          outputs: {
            calc_mode: "simple",
            spring_rate_n_per_mm: 18.6,
            deflection_mm: 8.06,
            shear_stress_mpa: 425.9,
            allowable_shear_mpa: 529,
            shear_pass: true,
            wahl_factor: 1.25,
            spring_index: 6,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "clutch") {
        return helper.response(200, {
          tool_id: "clutch",
          outputs: {
            calc_mode: "simple",
            torque_nm: 120,
            power_kw: 18.85,
            clamp_force_n: 5000,
            effective_radius_mm: 80,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "belt") {
        return helper.response(200, {
          tool_id: "belt",
          outputs: {
            calc_mode: "simple",
            ratio: 2.5,
            belt_length_mm: 1676,
            belt_speed_mps: 9.11,
            wrap_angle_deg: 180,
            tight_side_force_n: 1041,
            slack_side_force_n: 406,
            driven_rpm: 580,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "chain") {
        return helper.response(200, {
          tool_id: "chain",
          outputs: {
            calc_mode: "simple",
            ratio: 3,
            chain_length_mm: 1635,
            links: 103,
            chain_speed_mps: 3.62,
            chain_tension_n: 2115,
            driven_rpm: 240,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "tol_convert") {
        return helper.response(200, {
          tool_id: "tol_convert",
          outputs: {
            calc_mode: "simple",
            direction: "t2s",
            distribution: "normal",
            k_factor: 6,
            value: 0.25,
            input_tolerance: 0.25,
            output_sigma: 0.0417,
            result: 0.0417,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "sigma_analysis") {
        return helper.response(200, {
          tool_id: "sigma_analysis",
          outputs: {
            calc_mode: "simple",
            lsl: 9.875,
            usl: 10.125,
            mean: 10,
            sigma: 0.042,
            c: 0.99,
            cpk: 0.99,
            sigma_level: 2.98,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "fit") {
        return helper.response(200, {
          tool_id: "fit",
          outputs: {
            calc_mode: "simple",
            nominal_mm: 25,
            hole_code: "H7",
            shaft_code: "g6",
            fit_type: "clearance",
            max_clearance: 0.041,
            min_clearance: 0.007,
            hole: { min_size: 25.0, max_size: 25.021 },
            shaft: { min_size: 24.98, max_size: 24.993 },
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "distribution_chart") {
        return helper.response(200, {
          tool_id: "distribution_chart",
          outputs: {
            calc_mode: "simple",
            distribution: "normal",
            tolerance: 0.25,
            k_factor: 6,
            sigma: 0.0417,
            peak_density: 9.57,
            coverage: 0.9973,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "thermal_expansion") {
        return helper.response(200, {
          tool_id: "thermal_expansion",
          outputs: {
            calc_mode: "simple",
            material: "steel",
            length_mm: 100,
            delta_t: 100,
            operating_temp: 120,
            alpha1_micro: 11.5,
            linear_expansion: 0.115,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "interference_fit") {
        return helper.response(200, {
          tool_id: "interference_fit",
          outputs: {
            calc_mode: "simple",
            interference: 0.025,
            pressure: 42.5,
            hoop_hub: 85.0,
            hoop_shaft: 42.5,
            press_force: 85000,
            torque_capacity_nm: 200.5,
            min_hub_wall: 20.01,
            estimate_only: true,
            pass: false,
          },
        });
      }

      if (body.tool_id === "bearing") {
        return helper.response(200, {
          tool_id: "bearing",
          outputs: {
            calc_mode: "simple",
            equivalent_load: 5000,
            x: 1,
            y: 0,
            l10_million_rev: 343,
            life_hours: 3811,
            estimate_only: true,
            pass: false,
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

  test("opens and calculates on the spring design page", async function (assert) {
    await visit("/mechbox?tool_id=spring");

    await waitFor(".mechbox-spring");
    assert.dom(".mechbox-spring__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-spring__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert
      .dom("input[name='wire_diameter_mm']")
      .exists("wire diameter input is rendered");
    assert.dom(".mechbox-spring__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='load_n']", "150");
    await click(".mechbox-spring__calculate-btn");
    await waitFor(".mechbox-spring__status");

    assert.dom(".mechbox-spring__status").hasClass("is-attention");
    assert.dom(".mechbox-spring__results-body").includesText("18.6");

    await click(".mechbox-spring__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows free length");
  });

  test("opens and calculates on the clutch torque page", async function (assert) {
    await visit("/mechbox?tool_id=clutch");

    await waitFor(".mechbox-clutch");
    assert.dom(".mechbox-clutch__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-clutch__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert
      .dom("input[name='friction_coeff']")
      .exists("friction coefficient input is rendered");
    assert.dom(".mechbox-clutch__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='force_n']", "6000");
    await click(".mechbox-clutch__calculate-btn");
    await waitFor(".mechbox-clutch__status");

    assert.dom(".mechbox-clutch__status").hasClass("is-attention");
    assert.dom(".mechbox-clutch__results-body").includesText("120");

    await click(".mechbox-clutch__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows inner/outer diameters");
  });

  test("opens and calculates on the belt drive page", async function (assert) {
    await visit("/mechbox?tool_id=belt");

    await waitFor(".mechbox-belt");
    assert.dom(".mechbox-belt__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-belt__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert
      .dom("input[name='driver_diameter_mm']")
      .exists("driver diameter input is rendered");
    assert.dom(".mechbox-belt__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='power_kw']", "6");
    await click(".mechbox-belt__calculate-btn");
    await waitFor(".mechbox-belt__status");

    assert.dom(".mechbox-belt__status").hasClass("is-attention");
    assert.dom(".mechbox-belt__results-body").includesText("2.5");

    await click(".mechbox-belt__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows power per belt");
  });

  test("opens and calculates on the chain drive page", async function (assert) {
    await visit("/mechbox?tool_id=chain");

    await waitFor(".mechbox-chain");
    assert.dom(".mechbox-chain__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-chain__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='pitch_mm']").exists("pitch input is rendered");
    assert.dom(".mechbox-chain__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='power_kw']", "8");
    await click(".mechbox-chain__calculate-btn");
    await waitFor(".mechbox-chain__status");

    assert.dom(".mechbox-chain__status").hasClass("is-attention");
    assert.dom(".mechbox-chain__results-body").includesText("3");

    await click(".mechbox-chain__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows allow tension");
  });

  test("opens and calculates on the tolerance conversion page", async function (assert) {
    await visit("/mechbox?tool_id=tol_convert");

    await waitFor(".mechbox-tol-convert");
    assert.dom(".mechbox-tol-convert__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-tol-convert__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='value']").exists("value input is rendered");
    assert.dom(".mechbox-tol-convert__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='value']", "0.3");
    await click(".mechbox-tol-convert__calculate-btn");
    await waitFor(".mechbox-tol-convert__status");

    assert.dom(".mechbox-tol-convert__status").hasClass("is-attention");
    assert.dom(".mechbox-tol-convert__results-body").includesText("0.0417");

    await click(".mechbox-tol-convert__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows distribution");
  });

  test("opens and calculates on the sigma analysis page", async function (assert) {
    await visit("/mechbox?tool_id=sigma_analysis");

    await waitFor(".mechbox-sigma");
    assert.dom(".mechbox-sigma__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-sigma__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='lsl']").exists("lsl input is rendered");
    assert.dom(".mechbox-sigma__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='sigma']", "0.05");
    await click(".mechbox-sigma__calculate-btn");
    await waitFor(".mechbox-sigma__status");

    assert.dom(".mechbox-sigma__status").hasClass("is-attention");
    assert.dom(".mechbox-sigma__results-body").includesText("0.99");

    await click(".mechbox-sigma__mode-tab[data-calc-mode='professional']");
    assert
      .dom("[data-calc-show='professional']")
      .doesNotHaveClass("is-mode-hidden", "professional mode shows sample field");
  });

  test("opens and calculates on the ISO 286 fit page", async function (assert) {
    await visit("/mechbox?tool_id=fit");

    await waitFor(".mechbox-fit");
    assert.dom(".mechbox-fit__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-fit__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='nominal_mm']").exists("nominal input is rendered");
    assert.dom(".mechbox-fit__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='nominal_mm']", "30");
    await click(".mechbox-fit__calculate-btn");
    await waitFor(".mechbox-fit__status");

    assert.dom(".mechbox-fit__status").hasClass("is-attention");
    assert.dom(".mechbox-fit__results-body").includesText("41");

    await click(".mechbox-fit__mode-tab[data-calc-mode='professional']");
    assert
      .dom("[data-calc-show='professional']")
      .doesNotHaveClass("is-mode-hidden", "professional mode shows delta T");
  });

  test("opens and calculates on the distribution chart page", async function (assert) {
    await visit("/mechbox?tool_id=distribution_chart");

    await waitFor(".mechbox-distribution");
    assert.dom(".mechbox-distribution__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-distribution__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='tolerance']").exists("tolerance input is rendered");
    assert.dom(".mechbox-distribution__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='tolerance']", "0.3");
    await click(".mechbox-distribution__calculate-btn");
    await waitFor(".mechbox-distribution__status");

    assert.dom(".mechbox-distribution__status").hasClass("is-attention");
    assert.dom(".mechbox-distribution__results-body").includesText("0.0417");

    await click(".mechbox-distribution__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows distribution select");
  });

  test("opens and calculates on the thermal expansion page", async function (assert) {
    await visit("/mechbox?tool_id=thermal_expansion");

    await waitFor(".mechbox-thermal");
    assert.dom(".mechbox-thermal__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-thermal__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='length_mm']").exists("length input is rendered");
    assert.dom(".mechbox-thermal__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='delta_t']", "120");
    await click(".mechbox-thermal__calculate-btn");
    await waitFor(".mechbox-thermal__status");

    assert.dom(".mechbox-thermal__status").hasClass("is-attention");
    assert.dom(".mechbox-thermal__results-body").includesText("0.115");

    await click(".mechbox-thermal__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows shaft/hole diameters");
  });

  test("opens and calculates on the interference fit page", async function (assert) {
    await visit("/mechbox?tool_id=interference_fit");

    await waitFor(".mechbox-interference");
    assert.dom(".mechbox-interference__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-interference__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='shaft_diameter_mm']").exists("shaft input is rendered");
    assert.dom(".mechbox-interference__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='fit_length_mm']", "45");
    await click(".mechbox-interference__calculate-btn");
    await waitFor(".mechbox-interference__status");

    assert.dom(".mechbox-interference__status").hasClass("is-attention");
    assert.dom(".mechbox-interference__results-body").includesText("42.5");

    await click(".mechbox-interference__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows shaft inner diameter");
  });

  test("opens and calculates on the bearing life page", async function (assert) {
    await visit("/mechbox?tool_id=bearing");

    await waitFor(".mechbox-bearing");
    assert.dom(".mechbox-bearing__grid").exists("two-column grid is rendered");
    assert.dom(".mechbox-bearing__formula-bar").exists("formula bar is rendered");
    assert.dom(".mechbox-formula-hint").exists("inline formula hint is rendered");
    assert.dom("input[name='dynamic_load_n']").exists("dynamic load input is rendered");
    assert.dom(".mechbox-bearing__mode-tab").exists("mode tabs are rendered");

    await fillIn("input[name='rpm']", "1800");
    await click(".mechbox-bearing__calculate-btn");
    await waitFor(".mechbox-bearing__status");

    assert.dom(".mechbox-bearing__status").hasClass("is-attention");
    assert.dom(".mechbox-bearing__results-body").includesText("343");

    await click(".mechbox-bearing__mode-tab[data-calc-mode='full']");
    assert
      .dom("[data-calc-show='full professional']")
      .doesNotHaveClass("is-mode-hidden", "full mode shows static load");
  });
});
