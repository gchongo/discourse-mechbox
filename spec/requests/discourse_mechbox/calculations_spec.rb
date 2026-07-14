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
           tool_id: "gdt_position",
           save_record: true,
           inputs: {
             deviation_x_mm: 1.0,
             deviation_y_mm: 1.0,
           },
         }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["valid"]).to eq(true)
    expect(response.parsed_body["outputs"]["position_diameter_mm"]).to be_within(0.001).of(2.828)
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

  it "runs builtin bolt_clamp_load torque-to-force with stress check" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           save_record: false,
           inputs: {
             mode: "torque2force",
             torque_nm: 50,
             nut_factor: 0.2,
             nominal_diameter_mm: 10,
             pitch_mm: 1.5,
             grade: "8.8",
           },
         }

    expect(response).to have_http_status(:ok)
    json = response.parsed_body
    outputs = json["outputs"]

    expect(json["tool_id"]).to eq("bolt_clamp_load")
    expect(outputs["mode"]).to eq("torque2force")
    expect(outputs["grade"]).to eq("8.8")
    expect(outputs["preload_n"]).to eq(25_000.0)
    expect(outputs["preload_kn"]).to eq(25.0)
    expect(outputs["torque_nm"]).to eq(50.0)
    expect(outputs["stress_area_mm2"]).to be_within(0.1).of(57.99)
    expect(outputs["stress_mpa"]).to be_within(1.0).of(431.1)
    expect(outputs["allow_stress_mpa"]).to eq(400.0)
    expect(outputs["max_preload_n"]).to be_within(50.0).of(23_196.0)
    expect(outputs["pass"]).to eq(false)
    expect(outputs["estimate_only"]).to eq(true)
  end

  it "runs builtin bolt_clamp_load force-to-torque calculation" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           save_record: false,
           inputs: {
             mode: "force2torque",
             preload_n: 20_000,
             nut_factor: 0.2,
             nominal_diameter_mm: 10,
             grade: "8.8",
           },
         }

    expect(response).to have_http_status(:ok)
    outputs = response.parsed_body["outputs"]

    expect(outputs["mode"]).to eq("force2torque")
    expect(outputs["torque_nm"]).to eq(40.0)
    expect(outputs["preload_n"]).to eq(20_000.0)
    expect(outputs["pass"]).to eq(true)
  end

  it "returns 422 for invalid bolt_clamp_load mode" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "bolt_clamp_load",
           inputs: {
             mode: "unknown",
             torque_nm: 50,
             nut_factor: 0.2,
             nominal_diameter_mm: 10,
             grade: "8.8",
           },
         }

    expect(response).to have_http_status(:unprocessable_entity)
  end
end
