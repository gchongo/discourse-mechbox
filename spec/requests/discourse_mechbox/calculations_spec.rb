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
