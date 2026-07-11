# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox calculations", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    SiteSetting.mechbox_save_calculation_records = true
    sign_in(user)
  end

  it "runs builtin calculation and persists a record when requested" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "gear_ratio",
           title: "Gear ratio smoke test",
           save_record: true,
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
    expect(json["record_id"]).to be_present
  end

  it "validates inputs without persisting a record" do
    expect do
      post "/mechbox/api/calculate/validate",
           params: {
             tool_id: "gdt_position",
             save_record: true,
             inputs: {
               deviation_x_mm: 1.0,
               deviation_y_mm: 1.0,
             },
           }
    end.not_to change { DiscourseMechbox::CalculationRecord.count }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["valid"]).to eq(true)
  end
end
