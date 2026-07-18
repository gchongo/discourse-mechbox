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

    enabled_ids = %w[
      gear_ratio bolt_clamp_load unit_converter rss_calculation thread key bolt_group weld
      spring clutch belt chain tol_convert sigma_analysis fit distribution_chart
      thermal_expansion interference_fit bearing shaft gear fatigue beam sheet_metal
      cylinder o_ring structural manufacturing heat_treatment materials material_selection
      thread_table size_chain gdt_stack monte_carlo batch_analysis
    ]
    enabled_ids.each do |tool_id|
      tool = json["builtin_tools"].find { |t| t["tool_id"] == tool_id }
      expect(tool["available"]).to eq(true), "expected #{tool_id} to be available"
    end

    gdt_tool = json["builtin_tools"].find { |t| t["tool_id"] == "gdt_position" }
    expect(gdt_tool["available"]).to eq(false)

    expect(json["client_tools"].map { |tool| tool["tool_id"] }).not_to include("size_chain")
    expect(json["client_tools"].map { |tool| tool["tool_id"] }).not_to include("gdt_stack")
    expect(json["client_tools"].map { |tool| tool["tool_id"] }).not_to include("monte_carlo")
    expect(json["client_tools"].map { |tool| tool["tool_id"] }).not_to include("batch_analysis")
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
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("materials")
    expect(json["client_tools"].map { |t| t["tool_id"] }).not_to include("material_selection")
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
      "line_load_n_per_mm",
      "dynamic_factor",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "moment_nmm",
      "stress_mpa",
      "deflection_mm",
      "pass",
    )
  end

  it "returns a sheet_metal tool schema" do
    get "/mechbox/api/tools/sheet_metal"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("sheet_metal")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "method",
      "thickness_mm",
      "bend_radius_mm",
      "k_factor",
      "segments_json",
      "outer_sum_mm",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "flat_length_mm",
      "bend_count",
      "pass",
    )
  end

  it "returns a cylinder tool schema" do
    get "/mechbox/api/tools/cylinder"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("cylinder")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "cylinder_type",
      "bore_diameter_mm",
      "rod_diameter_mm",
      "pressure_mpa",
      "flow_rate_lpm",
      "external_load_n",
      "stroke_length_mm",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "extend_force_n",
      "retract_force_n",
      "buckling_load_n",
      "pass",
    )
  end

  it "returns an o_ring tool schema" do
    get "/mechbox/api/tools/o_ring"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("o_ring")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "cross_section_mm",
      "groove_diameter_mm",
      "groove_width_mm",
      "compression_percent",
      "extrusion_gap_mm",
      "material",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "groove_depth_mm",
      "fill_percent",
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
      "diameter_mm",
      "length_m",
      "flow_rate_lpm",
      "edge_condition",
      "case_id",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "velocity_mps",
      "critical_stress_mpa",
      "modal",
      "pass",
    )
  end

  it "returns a manufacturing tool schema" do
    get "/mechbox/api/tools/manufacturing"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["tool_id"]).to eq("manufacturing")
    expect(json["available"]).to eq(true)
    expect(json["implementation"]).to eq("server_builtin")
    expect(json["inputs"].map { |input| input["key"] }).to include(
      "analysis_type",
      "nominal_diameter_mm",
      "length_mm",
      "tolerance_grade",
      "depth_mm",
      "cast_material",
    )
    expect(json["outputs"].map { |output| output["key"] }).to include(
      "recommended_stock_diameter_mm",
      "draft_angle_deg",
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
