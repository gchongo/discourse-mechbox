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

    enabled_ids = %w[gear_ratio bolt_clamp_load unit_converter rss_calculation thread key bolt_group weld spring clutch belt chain tol_convert sigma_analysis fit distribution_chart thermal_expansion interference_fit bearing shaft gear fatigue]
    enabled_ids.each do |tool_id|
      tool = json["builtin_tools"].find { |t| t["tool_id"] == tool_id }
      expect(tool["available"]).to eq(true), "expected #{tool_id} to be available"
    end

    gdt_tool = json["builtin_tools"].find { |t| t["tool_id"] == "gdt_position" }
    expect(gdt_tool["available"]).to eq(false)

    %w[beam structural sheet_metal cylinder].each do |tool_id|
      tool = json["builtin_tools"].find { |t| t["tool_id"] == tool_id }
      expect(tool["available"]).to eq(false), "expected #{tool_id} to stay parked"
    end

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
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("shaft")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("gear")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("fatigue")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("beam")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("structural")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("sheet_metal")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("cylinder")
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

  it "returns a shaft tool schema" do
    get "/mechbox/api/tools/shaft"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("shaft")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "analysis_mode",
      "diameter_mm",
      "torque_nm",
      "bending_moment_nm",
      "stress_concentration_torsion",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "shear_stress_mpa",
      "equivalent_stress_mpa",
      "twist_angle_deg",
      "pass",
    )
  end

  it "returns a gear tool schema" do
    get "/mechbox/api/tools/gear"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("gear")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "module_mm",
      "pinion_teeth",
      "face_width_mm",
      "torque_nm",
      "iso1328_grade",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "bending_stress_mpa",
      "contact_stress_mpa",
      "safety_bending",
      "pass",
    )
  end

  it "returns a fatigue tool schema" do
    get "/mechbox/api/tools/fatigue"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("fatigue")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "material",
      "stress_amplitude_mpa",
      "target_life",
      "loads_json",
      "mean_stress_mpa",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "life_cycles",
      "miner",
      "pass",
    )
  end

  it "returns parked beam schema as unavailable" do
    get "/mechbox/api/tools/beam"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("beam")
    expect(json["available"]).to eq(false)
    expect(json["implementation"]).to eq("server_builtin")
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
