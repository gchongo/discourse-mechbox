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
