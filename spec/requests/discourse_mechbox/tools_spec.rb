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
    planned_tool = json["builtin_tools"].find { |tool| tool["tool_id"] == "unit_converter" }

    expect(gear_tool["available"]).to eq(true)
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
end
