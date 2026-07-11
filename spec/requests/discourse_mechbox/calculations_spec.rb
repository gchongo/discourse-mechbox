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
end
