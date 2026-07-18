# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox calculations", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "runs builtin gear_ratio calculation without persisting a record" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear_ratio",
           save_record: false,
           inputs: {
             driver_teeth: 20,
             driven_teeth: 40,
             input_speed_rpm: 1200,
           },
         }

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("gear_ratio")
    expect(json["outputs"]["ratio"]).to eq(2.0)
    expect(json["outputs"]["output_speed_rpm"]).to eq(600.0)
    expect(json["record_id"]).to be_nil
  end

  it "validates inputs without persisting a record" do
    post "/mechbox/api/calculate/validate",
         params: {
           tool_id: "unit_converter",
           save_record: true,
           inputs: {
             value: 25.4,
             from_unit: "mm",
             to_unit: "in",
           },
         }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["valid"]).to eq(true)
    expect(response.parsed_body["outputs"]["converted_value"]).to be_within(0.0001).of(1.0)
  end

  it "runs unit_converter length conversion" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "unit_converter",
           save_record: false,
           inputs: {
             value: 1,
             from_unit: "in",
             to_unit: "mm",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["converted_value"]).to be_within(0.001).of(25.4)
    expect(outputs["from_unit"]).to eq("in")
    expect(outputs["to_unit"]).to eq("mm")
  end

  it "runs rss_calculation" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "rss_calculation",
           save_record: false,
           inputs: {
             values: [3, 4],
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["rss"]).to eq(5.0)
    expect(outputs["count"]).to eq(2)
  end

  it "rejects gdt_position until it is folded into size_chain" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gdt_position",
           save_record: false,
           inputs: {
             deviation_x_mm: 0.03,
             deviation_y_mm: 0.04,
             tolerance_diameter_mm: 0.2,
           },
         }

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "runs simple thread strength calculation" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thread",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
             axial_force_n: 20_000,
             engaged_length_mm: 15,
             friction_coeff: 0.2,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["stress_area_mm2"]).to be > 0
    expect(outputs["tensile_stress_mpa"]).to be > 0
    expect(outputs["tightening_torque_nm"]).to be_within(0.1).of(40.0)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full thread strength with engagement check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thread",
           save_record: false,
           inputs: {
             calc_mode: "full",
             diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
             axial_force_n: 10_000,
             engaged_length_mm: 12,
             nut_material: "steel",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["min_engagement_mm"]).to eq(8.0)
    expect(outputs["engagement_pass"]).to eq(true)
    expect(outputs["critical_shear_side"]).to be_present
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional thread VDI torque" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thread",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
             axial_force_n: 20_000,
             engaged_length_mm: 15,
             nut_material: "steel",
             mu_g: 0.12,
             mu_k: 0.12,
             d_km: 14.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["torque_method"]).to eq("vdi_2230")
    expect(outputs["tightening_torque_nm"]).to be > 0
    expect(outputs["utilization"]).to be > 0
  end

  it "runs simple key crush/shear estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "key",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             torque_nm: 200,
             shaft_diameter_mm: 30,
             key_width_mm: 8,
             key_height_mm: 7,
             key_length_mm: 28,
             hub_length_mm: 28,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["tangential_force_n"]).to be_within(0.1).of(13_333.333)
    expect(outputs["shear_stress_mpa"]).to be_within(0.1).of(59.524)
    expect(outputs["crush_stress_mpa"]).to be_within(0.1).of(136.054)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full key length recommendation" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "key",
           save_record: false,
           inputs: {
             calc_mode: "full",
             torque_nm: 200,
             shaft_diameter_mm: 30,
             key_width_mm: 8,
             key_height_mm: 7,
             key_length_mm: 28,
             hub_length_mm: 28,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["recommended_length_mm"]).to be_within(0.1).of(25.397)
    expect(outputs["length_pass"]).to eq(true)
    expect(outputs["estimate_only"]).to eq(false)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional key with dual keys and amplitude gate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "key",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             torque_nm: 200,
             shaft_diameter_mm: 30,
             key_width_mm: 8,
             key_height_mm: 7,
             key_length_mm: 28,
             hub_length_mm: 28,
             key_count: 2,
             torque_amplitude_nm: 40,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["key_count"]).to eq(2)
    expect(outputs["force_per_key_n"]).to be_within(0.1).of(6_666.667)
    expect(outputs["shear_amplitude_mpa"]).to be > 0
    expect(outputs).to have_key("fatigue_pass")
  end

  it "runs simple bolt_group estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_group",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             bolt_count: 8,
             bolt_circle_radius_mm: 60,
             shear_x_n: 5000,
             shear_y_n: 2000,
             moment_nmm: 120_000,
             allow_per_bolt_n: 8000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["direct_per_bolt_n"]).to be_within(0.1).of(673.145)
    expect(outputs["torsion_per_bolt_n"]).to be_within(0.1).of(250.0)
    expect(outputs["max_bolt_force_n"]).to be_within(0.1).of(923.145)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full bolt_group vector decomposition" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_group",
           save_record: false,
           inputs: {
             calc_mode: "full",
             bolt_count: 8,
             bolt_circle_radius_mm: 60,
             shear_x_n: 5000,
             shear_y_n: 2000,
             moment_nmm: 120_000,
             allow_per_bolt_n: 8000,
             prying_arm_mm: 0,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["bolts"].size).to eq(8)
    expect(outputs["critical_bolt_index"]).to be_present
    expect(outputs["max_bolt_force_n"]).to be < 2000
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional bolt_group with slip failure" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_group",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             bolt_count: 4,
             bolt_circle_radius_mm: 50,
             shear_x_n: 20_000,
             shear_y_n: 0,
             moment_nmm: 0,
             friction_coeff: 0.2,
             clamp_force_per_bolt_n: 5000,
             allow_per_bolt_n: 50_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["friction"]["slip_pass"]).to eq(false)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs simple fillet weld estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "weld",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             weld_type: "fillet",
             steel_grade: "Q235",
             leg_size_mm: 6,
             weld_length_mm: 80,
             force_n: 20_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["weld_type"]).to eq("fillet")
    expect(outputs["throat_mm"]).to be_within(0.01).of(4.2)
    expect(outputs["shear_stress_mpa"]).to be_within(0.1).of(59.524)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full fillet weld three-standard comparison" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "weld",
           save_record: false,
           inputs: {
             calc_mode: "full",
             weld_type: "fillet",
             steel_grade: "Q235",
             leg_size_mm: 6,
             weld_length_mm: 80,
             force_n: 20_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["standards"].size).to eq(3)
    expect(outputs["strictest_standard"]).to be_present
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs full butt weld normal stress check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "weld",
           save_record: false,
           inputs: {
             calc_mode: "full",
             weld_type: "butt",
             steel_grade: "Q235",
             thickness_mm: 8,
             weld_length_mm: 100,
             force_n: 50_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["weld_type"]).to eq("butt")
    expect(outputs["normal_stress_mpa"]).to be_within(0.1).of(62.5)
    expect(outputs["standards"].size).to eq(3)
  end

  it "runs simple spring rate and shear estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "spring",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             material: "50CrVA",
             wire_diameter_mm: 3,
             mean_diameter_mm: 18,
             active_coils: 6,
             load_n: 200,
             allowable_shear_mpa: 700,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["spring_rate_n_per_mm"]).to be > 0
    expect(outputs["shear_stress_mpa"]).to be > 0
    expect(outputs["wahl_factor"]).to be > 1
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full spring with buckling and test load" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "spring",
           save_record: false,
           inputs: {
             calc_mode: "full",
             material: "50CrVA",
             wire_diameter_mm: 1.1,
             outer_diameter_mm: 6.5,
             active_coils: 5,
             total_coils: 7,
             free_length_mm: 15,
             install_height_mm: 13,
             working_height_mm: 12,
             allowable_shear_mpa: 529,
             end_type: "fixed",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["buckling"]).to be_present
    expect(outputs["test_load_n"]).to be > 0
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs simple clutch torque estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "clutch",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             friction_coeff: 0.15,
             force_n: 5000,
             radius_mm: 80,
             surfaces: 2,
             rpm: 1500,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["torque_nm"]).to be_within(0.1).of(120.0)
    expect(outputs["power_kw"]).to be > 0
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full clutch with contact pressure" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "clutch",
           save_record: false,
           inputs: {
             calc_mode: "full",
             friction_coeff: 0.15,
             force_n: 5000,
             inner_diameter_mm: 100,
             outer_diameter_mm: 160,
             surfaces: 2,
             rpm: 1500,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["effective_radius_mm"]).to be_within(0.1).of(66.15)
    expect(outputs["contact_pressure_mpa"]).to be > 0
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional clutch with derated torque check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "clutch",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             friction_coeff: 0.15,
             force_n: 5000,
             inner_diameter_mm: 100,
             outer_diameter_mm: 160,
             surfaces: 2,
             rpm: 1500,
             required_torque_nm: 100,
             thermal_fade: 0.9,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["derated_torque_nm"]).to be > 0
    expect(outputs["centrifugal_force_n"]).to be > 0
    expect(outputs["pass"]).to eq(false)
  end

  it "runs simple belt length and tension estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "belt",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             driver_diameter_mm: 120,
             driven_diameter_mm: 300,
             center_distance_mm: 500,
             rpm: 1450,
             power_kw: 5.5,
             wrap_angle_deg: 180,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["ratio"]).to be_within(0.01).of(2.5)
    expect(outputs["belt_length_mm"]).to be_within(1.0).of(1675.9)
    expect(outputs["tight_side_force_n"]).to be > 0
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full belt with geometric wrap angle and speed check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "belt",
           save_record: false,
           inputs: {
             calc_mode: "full",
             driver_diameter_mm: 120,
             driven_diameter_mm: 300,
             center_distance_mm: 500,
             rpm: 1450,
             power_kw: 5.5,
             power_per_belt_kw: 2.5,
             max_belt_speed_mps: 30,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["wrap_angle_deg"]).to be > 120
    expect(outputs["belt_count"]).to be >= 1
    expect(outputs["speed_pass"]).to eq(true)
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional belt with service factor and flex check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "belt",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             driver_diameter_mm: 120,
             driven_diameter_mm: 300,
             center_distance_mm: 500,
             rpm: 1450,
             power_kw: 5.5,
             power_per_belt_kw: 2.5,
             max_belt_speed_mps: 30,
             service_factor: 1.2,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["service_factor"]).to eq(1.2)
    expect(outputs["flex_stress_n_per_mm2"]).to be > 0
    expect(outputs["estimated_life_hours"]).to be > 0
  end

  it "runs simple chain length and tension estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "chain",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             pitch_mm: 15.875,
             driver_teeth: 19,
             driven_teeth: 57,
             center_distance_mm: 500,
             rpm: 720,
             power_kw: 7.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["ratio"]).to be_within(0.01).of(3.0)
    expect(outputs["chain_length_mm"]).to be_within(1.0).of(1635.125)
    expect(outputs["links"]).to eq(103)
    expect(outputs["chain_tension_n"]).to be > 0
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full chain with speed and tension checks" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "chain",
           save_record: false,
           inputs: {
             calc_mode: "full",
             pitch_mm: 15.875,
             driver_teeth: 19,
             driven_teeth: 57,
             center_distance_mm: 500,
             rpm: 720,
             power_kw: 7.5,
             allow_tension_n: 20_000,
             max_chain_speed_mps: 15,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["speed_pass"]).to eq(true)
    expect(outputs["tension_pass"]).to eq(true)
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional chain with strands and life estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "chain",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             pitch_mm: 15.875,
             driver_teeth: 19,
             driven_teeth: 57,
             center_distance_mm: 500,
             rpm: 720,
             power_kw: 7.5,
             allow_tension_n: 20_000,
             max_chain_speed_mps: 15,
             service_factor: 1.3,
             strands: 2,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["service_factor"]).to eq(1.3)
    expect(outputs["strands"]).to eq(2)
    expect(outputs["tension_per_strand_n"]).to be > 0
    expect(outputs["estimated_life_hours"]).to be > 0
  end

  it "runs simple tol_convert T to sigma with normal K=6" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "tol_convert",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             direction: "t2s",
             value: 0.25,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["direction"]).to eq("t2s")
    expect(outputs["distribution"]).to eq("normal")
    expect(outputs["output_sigma"]).to be_within(0.0001).of(0.25 / 6.0)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full tol_convert sigma to tolerance with triangular K" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "tol_convert",
           save_record: false,
           inputs: {
             calc_mode: "full",
             direction: "s2t",
             distribution: "triangular",
             value: 0.05,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["output_tolerance"]).to be_within(0.0001).of(0.05 * 4.24)
    expect(outputs["coverage"]).to eq(0.95)
    expect(outputs["estimate_only"]).to eq(false)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional tol_convert with custom K" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "tol_convert",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             direction: "t2s",
             distribution: "normal",
             value: 0.3,
             k_factor: 5.0,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["k_factor"]).to eq(5.0)
    expect(outputs["output_sigma"]).to be_within(0.0001).of(0.06)
  end

  it "runs simple sigma_analysis for C and Cpk" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sigma_analysis",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             lsl: 9.875,
             usl: 10.125,
             mean: 10.0,
             sigma: 0.042,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["c"]).to be_within(0.01).of(0.99)
    expect(outputs["cpk"]).to be_within(0.01).of(0.99)
    expect(outputs["sigma_level"]).to be_within(0.05).of(2.98)
  end

  it "runs full sigma_analysis with pass rate and gates" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sigma_analysis",
           save_record: false,
           inputs: {
             calc_mode: "full",
             lsl: 9.875,
             usl: 10.125,
             mean: 10.0,
             sigma: 0.042,
             min_cpk: 1.33,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["pass_rate"]).to be > 0.99
    expect(outputs).to have_key("dppm")
    expect(outputs["pass"]).to eq(false)
  end

  it "runs professional sigma_analysis with sample estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sigma_analysis",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             lsl: 9.875,
             usl: 10.125,
             mean: 10.0,
             sigma: 0.042,
             sample_values: "10.0, 10.01, 9.99, 10.02, 9.98",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["sample_count"]).to eq(5)
    expect(outputs["long_term_sigma_level"]).to be < outputs["sigma_level"]
  end

  it "runs simple fit for H7/g6 clearance" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fit",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             nominal_mm: 25,
             hole_code: "H7",
             shaft_code: "g6",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["fit_type"]).to eq("clearance")
    expect(outputs["min_clearance"]).to be > 0
    expect(outputs["max_clearance"]).to be > outputs["min_clearance"]
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full fit with fit quality" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fit",
           save_record: false,
           inputs: {
             calc_mode: "full",
             nominal_mm: 25,
             hole_code: "H7",
             shaft_code: "g6",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["pass"]).to eq(true)
    expect(outputs["fit_quality"]).to be_a(Numeric)
    expect(outputs["mean_clearance"]).to be > 0
  end

  it "runs professional fit with thermal shift" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fit",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             nominal_mm: 25,
             hole_code: "H7",
             shaft_code: "g6",
             delta_t: 50,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["delta_t"]).to eq(50.0)
    expect(outputs["thermal_shift"]).to eq(0.0)
    expect(outputs).to have_key("min_clearance_hot")
  end

  it "runs simple distribution_chart for normal PDF" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "distribution_chart",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             tolerance: 0.25,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["distribution"]).to eq("normal")
    expect(outputs["k_factor"]).to eq(6.0)
    expect(outputs["sigma"]).to be_within(0.0001).of(0.25 / 6.0)
    expect(outputs["peak_density"]).to be > 0
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full distribution_chart with curve points" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "distribution_chart",
           save_record: false,
           inputs: {
             calc_mode: "full",
             tolerance: 0.25,
             distribution: "triangular",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["distribution"]).to eq("triangular")
    expect(outputs["curve_points"]).to be_an(Array)
    expect(outputs["curve_points"].size).to eq(22)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional distribution_chart with yield" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "distribution_chart",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             tolerance: 0.25,
             distribution: "normal",
             mean: 0,
             lsl: -0.125,
             usl: 0.125,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["pass_rate"]).to be > 0.99
    expect(outputs).to have_key("dppm")
  end

  it "runs simple thermal_expansion linear growth" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thermal_expansion",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             material: "steel",
             length_mm: 100,
             delta_t: 100,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    # 11.5e-6 * 100 * 100 = 0.115 mm
    expect(outputs["linear_expansion"]).to be_within(0.0001).of(0.115)
    expect(outputs["operating_temp"]).to eq(120.0)
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full thermal_expansion with fit change" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thermal_expansion",
           save_record: false,
           inputs: {
             calc_mode: "full",
             material: "steel",
             material2: "steel",
             length_mm: 100,
             delta_t: 100,
             shaft_diameter_mm: 50,
             hole_diameter_mm: 49.975,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["fit"]).to be_present
    expect(outputs["fit"]["initial_interference"]).to be_within(0.0001).of(0.025)
    expect(outputs).to have_key("pass")
  end

  it "runs professional thermal_expansion with two-stage fit" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thermal_expansion",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             material: "aluminum",
             material2: "steel",
             length_mm: 100,
             delta_t: 150,
             shaft_diameter_mm: 50,
             hole_diameter_mm: 49.975,
             assembly_delta_t: 80,
             service_delta_t: 150,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["assembly_fit"]).to be_present
    expect(outputs["service_fit"]).to be_present
    expect(outputs).to have_key("interference_margin")
    expect(outputs).to have_key("recommended_max_delta_t")
  end

  it "runs simple interference_fit for contact pressure" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "interference_fit",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             shaft_diameter_mm: 50,
             hole_diameter_mm: 49.975,
             hub_outer_diameter_mm: 90,
             fit_length_mm: 40,
             friction: 0.12,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["interference"]).to be_within(0.0001).of(0.025)
    expect(outputs["pressure"]).to be > 0
    expect(outputs["press_force"]).to be > 0
    expect(outputs["torque_capacity_nm"]).to be > 0
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full interference_fit with hoop stress gates" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "interference_fit",
           save_record: false,
           inputs: {
             calc_mode: "full",
             shaft_diameter_mm: 50,
             hole_diameter_mm: 49.975,
             hub_outer_diameter_mm: 90,
             fit_length_mm: 40,
             shaft_allow_hoop_mpa: 350,
             hub_allow_hoop_mpa: 350,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["hoop_pass"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
    expect(outputs["hollow_shaft"]).to eq(false)
  end

  it "runs professional interference_fit with thermal correction" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "interference_fit",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             shaft_diameter_mm: 50,
             hole_diameter_mm: 49.975,
             hub_outer_diameter_mm: 90,
             fit_length_mm: 40,
             delta_t: 20,
             shaft_alpha_micro: 11.5,
             hole_alpha_micro: 11.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["thermal"]).to be_present
    expect(outputs["thermal"]["interference_change"]).to be_within(0.0001).of(0.0)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs simple bearing L10 life" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bearing",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             bearing_type: "ball",
             dynamic_load_n: 35_000,
             radial_load_n: 5_000,
             axial_load_n: 0,
             x: 1,
             y: 0,
             rpm: 1_500,
             target_hours: 10_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["equivalent_load"]).to be_within(0.1).of(5_000)
    expect(outputs["l10_million_rev"]).to be_within(0.1).of(343.0)
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full bearing with auto X/Y lookup" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bearing",
           save_record: false,
           inputs: {
             calc_mode: "full",
             auto_lookup: true,
             series_id: "deep-groove-medium",
             dynamic_load_n: 35_000,
             static_load_n: 18_000,
             radial_load_n: 5_000,
             axial_load_n: 1_000,
             rpm: 1_500,
             target_hours: 3_000,
             reliability: 90,
             life_condition: "standard",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["x"]).to eq(1.0)
    expect(outputs["y"]).to eq(0.0)
    expect(outputs["static_safety_factor"]).to be > 1
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional bearing with temperature factor" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bearing",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             auto_lookup: false,
             bearing_type: "ball",
             dynamic_load_n: 35_000,
             static_load_n: 18_000,
             radial_load_n: 5_000,
             axial_load_n: 1_000,
             x: 1,
             y: 1.6,
             rpm: 1_500,
             reliability: 95,
             life_condition: "standard",
             operating_temp_c: 200,
             limiting_speed_rpm: 8_000,
             target_hours: 1_000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["reliability_factor"]).to eq(0.64)
    expect(outputs["temperature_factor"]).to eq(0.75)
    expected_modified_life = outputs["l10_million_rev"] * 0.64 * 1.0 * 0.75
    expect(outputs["modified_life_million_rev"]).to be_within(0.001).of(expected_modified_life)
    expect(outputs["radial_stiffness"]).to be > 0
    expect(outputs["speed_pass"]).to eq(true)
  end

  it "runs simple shaft torsion" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "shaft",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_mode: "torsion",
             material_id: "q235",
             diameter_mm: 40,
             torque_nm: 200,
             length_mm: 500,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["analysis_mode"]).to eq("torsion")
    expect(outputs["shear_stress_mpa"]).to be_within(0.1).of(15.915)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs full shaft hollow torsion with twist gate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "shaft",
           save_record: false,
           inputs: {
             calc_mode: "full",
             analysis_mode: "torsion",
             material_id: "q235",
             diameter_mm: 40,
             inner_diameter_mm: 20,
             torque_nm: 200,
             length_mm: 500,
             max_twist_angle_deg: 0.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["hollow_shaft"]).to eq(true)
    expect(outputs["shear_stress_mpa"]).to be > 15
    expect(outputs["twist_angle_deg"]).to be > 0
    expect(outputs).to have_key("angle_pass")
  end

  it "runs professional shaft combined with Kt" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "shaft",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             analysis_mode: "combined",
             material_id: "45",
             diameter_mm: 40,
             torque_nm: 200,
             bending_moment_nm: 150,
             stress_concentration_bending: 1.5,
             stress_concentration_torsion: 1.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["equivalent_stress_mpa"]).to be > 0
    expect(outputs["fatigue_released"]).to eq(false)
    expect(outputs["stress_concentration_bending"]).to eq(1.5)
  end

  it "runs simple gear Lewis estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             module_mm: 2,
             pinion_teeth: 24,
             gear_teeth: 72,
             face_width_mm: 20,
             torque_nm: 50,
             rpm: 1000,
             material: "st-soft",
             form_factor: 2.65,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["standard"]).to eq("Lewis")
    expect(outputs["tangential_force_n"]).to be_within(0.1).of(2083.33)
    expect(outputs["bending_stress_mpa"]).to be_within(0.1).of(19.65)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full gear ISO 6336 simplified check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear",
           save_record: false,
           inputs: {
             calc_mode: "full",
             module_mm: 2,
             pinion_teeth: 24,
             gear_teeth: 72,
             face_width_mm: 20,
             torque_nm: 50,
             rpm: 1000,
             pinion_material: "st-soft",
             gear_material: "st-soft",
             application_factor: 1.25,
             iso1328_grade: 6,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["standard"]).to eq("ISO6336")
    expect(outputs["contact_stress_mpa"]).to be > 0
    expect(outputs["bending_stress_mpa"]).to be > 0
    expect(outputs["safety_contact"]).to be > 0
    expect(outputs["factors"]["KV"]).to be >= 1
  end

  it "runs professional gear ISO and AGMA compare" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             module_mm: 2,
             pinion_teeth: 24,
             gear_teeth: 72,
             face_width_mm: 20,
             torque_nm: 50,
             rpm: 1000,
             pinion_material: "case-carburized",
             gear_material: "case-carburized",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["agma"]).to be_present
    expect(outputs["compare"]).to be_present
    expect(outputs["compare"]).to have_key("both_pass")
  end

  it "runs simple fatigue Basquin life estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fatigue",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             material: "steel_45",
             stress_amplitude_mpa: 350,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["life_cycles"]).to be_within(1000).of(66_924)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full fatigue with Miner spectrum" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fatigue",
           save_record: false,
           inputs: {
             calc_mode: "full",
             material: "steel_45",
             stress_amplitude_mpa: 300,
             target_life: 1_000_000,
             loads_json: "300,10000\n250,50000\n200,100000",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["miner"]).to be_present
    expect(outputs["miner"]["total_damage"]).to be_within(0.001).of(0.024)
    expect(outputs["miner"]["pass"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional fatigue with Goodman and Se prime" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "fatigue",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             material: "steel_45",
             stress_amplitude_mpa: 200,
             mean_stress_mpa: 100,
             mean_stress_method: "goodman",
             surface_factor: 0.9,
             size_factor: 0.85,
             target_life: 1_000_000,
             loads_json: [{ stress: 250, cycles: 5000 }].to_json,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["effective_amplitude_mpa"]).to be > 200
    expect(outputs["adjusted_endurance_mpa"]).to be_within(0.1).of(214.2)
    expect(outputs["miner"]).to be_present
    expect(outputs["miner"]["details"].first["effective_stress_mpa"]).to be > 250
  end

  it "runs simple beam stress and deflection estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "beam",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             material_id: "q235",
             case_id: "simply_center",
             section_type: "solid_round",
             diameter_mm: 30,
             span_length_mm: 500,
             load_n: 2000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["stress_mpa"]).to be_within(0.001).of(94.314)
    expect(outputs["deflection_mm"]).to be_within(0.001).of(0.635882)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["deflection_pass"]).to eq(false)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full beam utilization checks" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "beam",
           save_record: false,
           inputs: {
             calc_mode: "full",
             material_id: "q235",
             case_id: "simply_center",
             section_type: "solid_round",
             diameter_mm: 30,
             span_length_mm: 500,
             load_n: 2000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["stress_utilization"]).to be_present
    expect(outputs["deflection_utilization"]).to be_present
    expect(outputs["min_section_modulus_stress_mm3"]).to be_present
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional beam with dynamic factor and Kt" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "beam",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             material_id: "q235",
             case_id: "simply_center",
             section_type: "solid_round",
             diameter_mm: 30,
             span_length_mm: 500,
             load_n: 2000,
             dynamic_factor: 1.2,
             stress_concentration: 1.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["dynamic_factor"]).to eq(1.2)
    expect(outputs["stress_concentration"]).to eq(1.5)
    expect(outputs["stress_mpa"]).to be > 94.314
    expect(outputs["fatigue_available"]).to eq(false)
  end

  it "runs simple sheet_metal K-factor unfold" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sheet_metal",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             method: "k_factor",
             thickness_mm: 1.5,
             bend_radius_mm: 1.5,
             k_factor: 0.33,
             segments_json: [
               { type: "straight", length: 50 },
               { type: "bend", angle: 90 },
               { type: "straight", length: 50 },
             ].to_json,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["bend_count"]).to eq(1)
    expect(outputs["flat_length_mm"]).to be_within(0.01).of(103.134)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full sheet_metal flange check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sheet_metal",
           save_record: false,
           inputs: {
             calc_mode: "full",
             method: "k_factor",
             thickness_mm: 1.5,
             segments_json: [
               { type: "straight", length: 50 },
               { type: "bend", angle: 90 },
               { type: "straight", length: 50 },
             ].to_json,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["min_flange_rule_mm"]).to be_within(0.01).of(6.0)
    expect(outputs["flange_pass"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional sheet_metal with springback" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "sheet_metal",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             method: "k_factor",
             thickness_mm: 1.5,
             bend_radius_mm: 1.5,
             springback_deg: 0.5,
             segments_json: [
               { type: "straight", length: 50 },
               { type: "bend", angle: 90 },
               { type: "straight", length: 50 },
             ].to_json,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["compensated_flat_length_mm"]).to be > outputs["flat_length_mm"]
    expect(outputs["radius_pass"]).to eq(true)
    expect(outputs["springback_estimate_only"]).to eq(true)
  end

  it "runs simple cylinder force and velocity estimate" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "cylinder",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             cylinder_type: "hydraulic",
             bore_diameter_mm: 50,
             rod_diameter_mm: 20,
             pressure_mpa: 16,
             flow_rate_lpm: 20,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["bore_area_mm2"]).to be_within(0.01).of(1963.495)
    expect(outputs["extend_force_n"]).to be_within(1.0).of(31_415.9)
    expect(outputs["retract_force_n"]).to be_within(1.0).of(26_389.4)
    expect(outputs["extend_velocity_mm_s"]).to be_within(0.1).of(169.77)
    expect(outputs["estimate_only"]).to eq(true)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs full cylinder load and buckling checks" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "cylinder",
           save_record: false,
           inputs: {
             calc_mode: "full",
             cylinder_type: "hydraulic",
             bore_diameter_mm: 50,
             rod_diameter_mm: 20,
             pressure_mpa: 16,
             flow_rate_lpm: 20,
             external_load_n: 8000,
             stroke_length_mm: 300,
             end_fixity: "pinned_pinned",
             yield_strength_mpa: 235,
             compress_on_retract: true,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["load_pass"]).to eq(true)
    expect(outputs["buckling_load_n"]).to be > 0
    expect(outputs["pass"]).to eq(true)
  end

  it "runs professional cylinder with dynamic load" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "cylinder",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             cylinder_type: "hydraulic",
             bore_diameter_mm: 50,
             rod_diameter_mm: 20,
             pressure_mpa: 16,
             flow_rate_lpm: 20,
             external_load_n: 8000,
             stroke_length_mm: 300,
             load_mass_kg: 500,
             acceleration_m_s2: 0.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["dynamic_load_n"]).to be_within(1.0).of(500 * 9.81 + 500 * 0.5)
    expect(outputs["cycle_time_extend_s"]).to be_present
    expect(outputs["cushion_force_n"]).to be_present
  end

  it "runs simple o_ring gland check matching MechBox defaults" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "o_ring",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             cross_section_mm: 3.53,
             groove_diameter_mm: 18.5,
             groove_width_mm: 4.8,
             compression_percent: 20,
             stretch_percent: 2,
             pressure_mpa: 0,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["groove_depth_mm"]).to be_within(0.001).of(2.824)
    expect(outputs["compression_mm"]).to be_within(0.001).of(0.706)
    expect(outputs["fill_percent"]).to be_within(0.05).of(72.199)
    expect(outputs["width_ok"]).to eq(true)
    expect(outputs["fill_ok"]).to eq(true)
    expect(outputs["compression_ok"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
    expect(outputs["free_id_mm"]).to be_within(0.001).of(18.5)
    expect(outputs["installed_id_mm"]).to be_within(0.001).of(18.87)
  end

  it "runs full o_ring extrusion and temperature checks" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "o_ring",
           save_record: false,
           inputs: {
             calc_mode: "full",
             cross_section_mm: 3.53,
             groove_diameter_mm: 18.5,
             groove_width_mm: 4.8,
             compression_percent: 20,
             pressure_mpa: 5,
             extrusion_gap_mm: 0.1,
             material: "nbr",
             operating_temp_c: 25,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["max_extrusion_gap_mm"]).to be_within(0.001).of(0.21)
    expect(outputs["extrusion_pass"]).to eq(true)
    expect(outputs["temp_pass"]).to eq(true)
    expect(outputs["material"]).to eq("nbr")
  end

  it "runs professional o_ring pressure limit from extrusion gap" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "o_ring",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             cross_section_mm: 3.53,
             groove_diameter_mm: 18.5,
             groove_width_mm: 4.8,
             compression_percent: 20,
             pressure_mpa: 20,
             extrusion_gap_mm: 0.15,
             stroke_speed_m_s: 0.2,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["max_allow_pressure_mpa"]).to be_within(0.01).of(58.333)
    expect(outputs["pressure_pass"]).to eq(true)
    expect(outputs["speed_pass"]).to eq(true)
  end

  it "runs simple structural pipe Darcy-Weisbach drop" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "structural",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_type: "pipe_flow",
             diameter_mm: 25,
             length_m: 10,
             flow_rate_lpm: 20,
             density_kg_m3: 998,
             dynamic_viscosity_pa_s: 1.002e-3,
             roughness_mm: 0.045,
             local_loss_k: 5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["analysis_type"]).to eq("pipe_flow")
    expect(outputs["length_m"]).to eq(10)
    expect(outputs["velocity_mps"]).to be_within(0.001).of(0.679)
    expect(outputs["pressure_drop_kpa"]).to be_within(0.05).of(2.816)
    expect(outputs["total_pressure_drop_kpa"]).to eq(outputs["pressure_drop_kpa"])
    expect(outputs["local_loss_k"]).to eq(0.0)
  end

  it "runs simple structural plate buckling" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "structural",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_type: "plate_buckling",
             edge_condition: "ssss",
             thickness_mm: 2,
             width_mm: 200,
             length_mm: 400,
             applied_stress_mpa: 50,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["analysis_type"]).to eq("plate_buckling")
    expect(outputs["buckling_coefficient"]).to be_within(0.001).of(4.4)
    expect(outputs["critical_stress_mpa"]).to be_within(0.1).of(83.512)
    expect(outputs["safety_factor"]).to be_within(0.01).of(1.67)
    expect(outputs["pass"]).to eq(false)
  end

  it "runs simple structural SDOF modal frequency" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "structural",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_type: "modal",
             case_id: "sdof",
             stiffness_n_m: 10_000,
             mass_kg: 10,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["analysis_type"]).to eq("modal")
    expect(outputs["modal"]["fn_hz"]).to be_within(0.02).of(5.033)
  end

  it "runs simple manufacturing machining allowance" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "manufacturing",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_type: "machining",
             nominal_diameter_mm: 50,
             length_mm: 100,
             tolerance_grade: "medium",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["analysis_type"]).to eq("machining")
    expect(outputs["operations"]).to eq(%w[rough finish])
    expect(outputs["end_face_allowance_mm"]).to eq(1.0)
    expect(outputs["total_radial_allowance_mm"]).to be_within(0.001).of(2.2)
    expect(outputs["recommended_stock_diameter_mm"]).to be_within(0.001).of(54.4)
    expect(outputs["recommended_stock_length_mm"]).to be_within(0.001).of(102.0)
    expect(outputs["details"].length).to eq(2)
  end

  it "runs full manufacturing machining with grinding" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "manufacturing",
           save_record: false,
           inputs: {
             calc_mode: "full",
             analysis_type: "machining",
             nominal_diameter_mm: 50,
             length_mm: 100,
             tolerance_grade: "medium",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["operations"]).to eq(%w[rough semi finish])
    expect(outputs["grinding_allowance_mm"]).to be_within(0.001).of(0.2)
    expect(outputs["end_face_allowance_mm"]).to eq(2.0)
  end

  it "runs simple manufacturing casting draft angle" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "manufacturing",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             analysis_type: "casting",
             cast_material: "sand_iron",
             surface_type: "external",
             depth_mm: 80,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["analysis_type"]).to eq("casting")
    expect(outputs["draft_angle_deg"]).to be_within(0.01).of(1.679)
    expect(outputs["total_width_increase_mm"]).to be_within(0.05).of(4.69)
    expect(outputs["pass"]).to eq(true)
  end

  it "runs full heat_treatment for 4140" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "heat_treatment",
           save_record: false,
           inputs: {
             calc_mode: "full",
             steel_preset: "4140",
             part_diameter_mm: 50,
             grain_size: 7,
             temper_temp_c: 550,
             temper_time_h: 2,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["carbon_equivalent"]).to be_within(0.001).of(0.772)
    expect(outputs["weldability_key"]).to eq("bad")
    expect(outputs["hardenability"]["ideal_critical_diameter_mm"]).to be_within(0.1).of(18.8)
    expect(outputs["hardenability"]["surface_hrc"]).to be_within(0.1).of(47.9)
    expect(outputs["hardenability"]["estimated_core_hrc"]).to be_within(0.1).of(29.3)
    expect(outputs["hardenability"]["ratio"]).to be_within(0.01).of(2.66)
    expect(outputs["temper"]["tempered_hrc"]).to be_within(0.1).of(28.3)
    expect(outputs["pass"]).to eq(false)
  end

  it "browses materials library with temperature derating" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "materials",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             query: "q235",
             temp_c: 100,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["total_count"]).to eq(56)
    expect(outputs["count"]).to be >= 1
    row = outputs["materials"].find { |m| m["id"] == "q235" }
    expect(row).to be_present
    expect(row["sigma_allow_at_temp_mpa"]).to eq(119)
    expect(row["tau_allow_at_temp_mpa"]).to eq(71)
    expect(row["E"]).to eq(row["e_mpa"])
  end

  it "ranks material_selection with default weights" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "material_selection",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             min_sigma_allow_mpa: 150,
             max_density: 8,
             temp_c: 20,
             min_weldability: 2,
             max_cost_index: 3,
             weight_strength: 0.35,
             weight_light: 0.2,
             weight_cost: 0.2,
             weight_weldability: 0.15,
             weight_machinability: 0.1,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["filtered_count"]).to eq(29)
    expect(outputs["total_count"]).to eq(56)
    expect(outputs["top_pick"]["id"]).to eq("cr12mo1v1")
    expect(outputs["top_pick"]["total_score"]).to be_within(0.01).of(67.961)
    expect(outputs["recommendations"].length).to eq(5)
  end

  it "looks up and filters thread_table metric M10 rows" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "thread_table",
           save_record: false,
           inputs: {
             system: "metric",
             query: "M10",
             priority: 1,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["total_count"]).to eq(453)
    expect(outputs["matched_count"]).to be >= 1
    expect(outputs["rows"].first["designation"]).to include("M10")
    expect(outputs["rows"].first["system"]).to eq("metric")
    expect(outputs["rows"].first["pitch"]).to be_a(Numeric)
    expect(outputs["rows"]).to all(include("priority" => 1))
    expect(outputs["page"]).to eq(1)
    expect(outputs["page_count"]).to be >= 1
    expect(outputs["systems"].map { |s| s["id"] }).to include("metric", "unc")
  end

  it "calculates worst-case and RSS bounds for a linear size chain" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "size_chain",
           save_record: false,
           inputs: {
             closed_ring: { name: "间隙 L0", min: 0.1, max: 0.35, unit: "mm" },
             component_rings: [
               { name: "挡环厚度", size: 40, tolerance: 0.06, type: "decreasing" },
               { name: "齿轮宽度", size: 15, tolerance: 0.05, type: "decreasing" },
               { name: "轴径", size: 55.25, tolerance: 0.04, type: "increasing" },
             ],
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["worst"]).to include(
      "nominal" => 0.25,
      "lower" => 0.175,
      "upper" => 0.325,
      "total_tolerance" => 0.15,
      "pass" => true,
    )
    expect(outputs["rss"]["total_tolerance"]).to be_within(0.000001).of(0.087749)
    expect(outputs["rss"]).to include("pass" => true)
    expect(outputs["ring_contributions"].first["percent"]).to be_within(0.01).of(46.153846)
  end

  it "warns when RSS passes but worst-case fails" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "size_chain",
           save_record: false,
           inputs: {
             closed_ring: { min: 0.19, max: 0.31 },
             component_rings: [
               { name: "增环 A", size: 0.125, tolerance: 0.08, type: "increasing" },
               { name: "增环 B", size: 0.125, tolerance: 0.08, type: "increasing" },
             ],
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["rss"]["pass"]).to eq(true)
    expect(outputs["worst"]["pass"]).to eq(false)
    expect(outputs["warnings"]).to include("rss_pass_worst_fail")
  end

  it "calculates a position GD&T stack with datum accumulation and MMC bonus" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gdt_stack",
           save_record: false,
           inputs: {
             type_id: "position",
             method: "rss",
             closed_ring: { min: 0, max: 0.15 },
             rings: [
               { name: "X 定位", tolerance: 0.05, direction: "right", factor: 1, type: "increasing" },
               { name: "Y 定位", tolerance: 0.04, direction: "up", factor: 1, type: "increasing" },
               {
                 name: "孔径",
                 tolerance: 0.02,
                 direction: "right",
                 factor: 0.5,
                 type: "increasing",
                 feature_kind: "hole",
                 size_tolerance: 0.03,
               },
             ],
             datums: [
               { label: "A 底面", priority: "primary", tolerance: 0.02 },
               { label: "B 侧面", priority: "secondary", tolerance: 0.03 },
             ],
             tolerance_modifier: "MMC",
             auto_bonus: true,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["type_id"]).to eq("position")
    expect(outputs["chain"]["total_tolerance"]).to be_within(0.000001).of(0.064807)
    expect(outputs["chain"]["pass"]).to eq(true)
    expect(outputs["modifier"]["bonus"]).to be_within(0.000001).of(0.03)
    expect(outputs["datum_stack"]["total"]).to be_within(0.000001).of(0.029)
    expect(outputs["effective_with_datum"]).to be_within(0.000001).of(0.071)
    expect(outputs["pass"]).to eq(true)
    expect(outputs["contributions"]).not_to be_empty
  end

  it "calculates a flatness GD&T stack with RSS form stack" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gdt_stack",
           save_record: false,
           inputs: {
             type_id: "flatness",
             method: "rss",
             closed_ring: { min: 0, max: 0.08 },
             rings: [
               { name: "面1", tolerance: 0.03, factor: 1, type: "increasing" },
               { name: "面2", tolerance: 0.025, factor: 1, type: "increasing" },
               { name: "面3", tolerance: 0.02, factor: 1, type: "increasing" },
             ],
             datums: [],
             tolerance_modifier: "RFS",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]
    expect(outputs["chain"]["total_tolerance"]).to be_within(0.000001).of(0.043875)
    expect(outputs["chain"]["pass"]).to eq(true)
    expect(outputs["pass"]).to eq(true)
  end

  it "returns 422 for invalid gear_ratio inputs" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear_ratio",
           inputs: {
             driver_teeth: 0,
             driven_teeth: 40,
             input_speed_rpm: 1200,
           },
         }

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "runs simple bolt_clamp_load torque-to-force with stress check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           save_record: false,
           inputs: {
             calc_mode: "simple",
             mode: "torque2force",
             torque_nm: 50,
             nut_factor: 0.2,
             nominal_diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]

    expect(outputs["calc_mode"]).to eq("simple")
    expect(outputs["preload_n"]).to eq(25_000.0)
    expect(outputs["stress_area_mm2"]).to be_within(0.1).of(57.99)
    expect(outputs["stress_mpa"]).to be_within(1.0).of(431.1)
    expect(outputs["pass"]).to eq(false)
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs full VDI bolt_clamp_load calculation" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           save_record: false,
           inputs: {
             calc_mode: "full",
             mode: "torque2force",
             torque_nm: 50,
             nominal_diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
             mu_g: 0.12,
             mu_k: 0.12,
             d_km: 14.5,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]

    expect(outputs["calc_mode"]).to eq("full")
    expect(outputs["preload_n"]).to be > 0
    expect(outputs["torque_thread_nm"]).to be > 0
    expect(outputs["torque_head_nm"]).to be > 0
    expect(outputs["estimate_only"]).to eq(false)
  end

  it "runs professional bolt_clamp_load residual preload" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           save_record: false,
           inputs: {
             calc_mode: "professional",
             mode: "force2torque",
             preload_n: 20_000,
             nominal_diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
             mu_g: 0.12,
             mu_k: 0.12,
             d_km: 14.5,
             grip_length: 20,
             hole_diameter: 11,
             head_contact_diameter: 15,
             outer_diameter: 43,
             embedment_um: 11,
             delta_t: 0,
             external_axial_load: 5000,
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]

    expect(outputs["calc_mode"]).to eq("professional")
    expect(outputs["preload_tightening_n"]).to be > outputs["preload_residual_n"]
    expect(outputs["preload_residual_n"]).to be_within(1.0).of(20_000.0)
    expect(outputs["embedment_loss_n"]).to be > 0
    expect(outputs["max_bolt_force"]).to be > outputs["preload_residual_n"]
    expect(outputs["separation_pass"]).to eq(true)
  end
end
