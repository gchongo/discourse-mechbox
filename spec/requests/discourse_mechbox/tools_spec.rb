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

    enabled_ids = %w[gear_ratio bolt_clamp_load unit_converter rss_calculation thread key bolt_group weld spring clutch belt chain tol_convert sigma_analysis fit distribution_chart thermal_expansion interference_fit bearing beam structural]
    enabled_ids.each do |tool_id|
      tool = json["builtin_tools"].find { |t| t["tool_id"] == tool_id }
      expect(tool["available"]).to eq(true), "expected #{tool_id} to be available"
    end

    gdt_tool = json["builtin_tools"].find { |t| t["tool_id"] == "gdt_position" }
    expect(gdt_tool["available"]).to eq(false)

    planned_client = json["client_tools"].find { |tool| tool["tool_id"] == "size_chain" }
    expect(planned_client["available"]).to eq(false)
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("thread")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("key")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("bolt_group")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("weld")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("spring")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("clutch")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("belt")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("chain")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("beam")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("structural")
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

  it "returns a beam tool schema" do
    get "/mechbox/api/tools/beam"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("beam")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "case_id",
      "section_type",
      "span_length_mm",
      "load_n",
      "allowable_deflection_mm",
      "line_load_n_per_mm",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "stress_mpa",
      "deflection_mm",
      "line_load_n_per_mm",
      "slenderness_warning",
      "pass",
    )
  end

  it "returns a structural tool schema" do
    get "/mechbox/api/tools/structural"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("structural")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "analysis_type",
      "length_m",
      "flow_rate_lpm",
      "thickness_mm",
      "stiffness_n_m",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "total_pressure_drop_kpa",
      "critical_stress_mpa",
      "modal",
      "pass",
    )
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
