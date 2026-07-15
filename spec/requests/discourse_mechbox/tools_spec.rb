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

    enabled_ids = %w[gear_ratio bolt_clamp_load unit_converter rss_calculation gdt_position]
    enabled_ids.each do |tool_id|
      tool = json["builtin_tools"].find { |t| t["tool_id"] == tool_id }
      expect(tool["available"]).to eq(true), "expected #{tool_id} to be available"
    end

    planned_client = json["client_tools"].find { |tool| tool["tool_id"] == "size_chain" }
    expect(planned_client["available"]).to eq(false)
    expect(json["design_chains"]).to eq([])
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
      "nominal_diameter_mm",
      "grade",
      "nut_factor",
      "torque_nm",
      "preload_n",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "preload_n",
      "stress_mpa",
      "pass",
    )
  end
end
