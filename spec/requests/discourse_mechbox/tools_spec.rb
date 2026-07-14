# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox tools", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "lists builtin and client tool catalogs" do
    get "/mechbox/api/tools"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    gear_tool = json["builtin_tools"].find { |tool| tool["tool_id"] == "gear_ratio" }
    bolt_tool = json["builtin_tools"].find { |tool| tool["tool_id"] == "bolt_clamp_load" }
    planned_tool = json["builtin_tools"].find { |tool| tool["tool_id"] == "unit_converter" }

    expect(gear_tool["available"]).to eq(true)
    expect(bolt_tool["available"]).to eq(true)
    expect(planned_tool["available"]).to eq(false)
    expect(json["client_tools"]).to be_an(Array)
    expect(json["design_chains"].map { |chain| chain["tool_id"] }).to include(
      "shaft_system_chain",
      "bolt_connection_chain",
    )
    expect(json["design_chains"].first["available"]).to eq(false)
  end

  it "returns a builtin tool schema" do
    get "/mechbox/api/tools/gear_ratio"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("gear_ratio")
    expect(json["available"]).to eq(true)
    expect(json["inputs"]).not_to be_empty
    expect(json["outputs"]).not_to be_empty
    expect(json["formula_templates"]).to eq([])
  end

  it "returns a bolt preload tool schema" do
    get "/mechbox/api/tools/bolt_clamp_load"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("bolt_clamp_load")
    expect(json["available"]).to eq(true)
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "mode",
      "torque_nm",
      "preload_n",
      "nut_factor",
      "nominal_diameter_mm",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "preload_n",
      "preload_kn",
      "torque_nm",
    )
  end
end
