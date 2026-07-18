# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox metadata", type: :request do
  fab!(:user) { Fabricate(:user) }
  fab!(:allowed_group) { Fabricate(:group) }
  fab!(:member) { Fabricate(:user, refresh_auto_groups: true) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "returns the Phase 0.5.9 catalog contract" do
    get "/mechbox/api/metadata"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["mode"]).to eq("phase1_3")
    expect(json["api_version"]).to eq(1)
    expect(json["capabilities"]["metadata"]["enabled"]).to eq(true)
    expect(json["capabilities"]["tools"]["enabled"]).to eq(true)
    expect(json["capabilities"]["calculate"]["enabled"]).to eq(true)
    expect(json["capabilities"]["calculate_validate"]["enabled"]).to eq(true)
    expect(json["capabilities"]["records_index"]["enabled"]).to eq(false)
    expect(json["capabilities"]["favorites"]["enabled"]).to eq(false)
    expect(json["settings"]["default_unit_system"]).to be_present
    expect(json["settings"]["effective_unit_system"]).to eq("metric")
    expect(json["settings"]["can_manage_templates"]).to eq(false)
    expect(json["builtin_tools"].size).to eq(28)
    expect(json["categories"]).to be_present
    expect(json["design_chains"]).to eq([])
    expect(json["home"]["available_tools"].map { |t| t["tool_id"] }).to include(
      "gear_ratio",
      "bolt_clamp_load",
      "thread",
      "key",
      "bolt_group",
      "weld",
      "spring",
      "clutch",
      "belt",
      "chain",
      "tol_convert",
      "sigma_analysis",
      "fit",
      "distribution_chart",
      "thermal_expansion",
      "interference_fit",
      "bearing",
      "shaft",
      "gear",
      "fatigue",
      "beam",
      "sheet_metal",
      "cylinder",
      "o_ring",
      "structural",
    )
    expect(json["home"]["mech_groups"].map { |g| g["id"] }).not_to include("design-chain")
    expect(json["home"]["counts"]["available"]).to eq(27)
    expect(json["home"]["counts"]["catalog"]).to be > 40
    expect(json["formula_templates"]).to eq([])
    expect(json["favorite_tool_ids"]).to eq([])
    expect(json["preferences"]["favorite_layout"]).to eq("grid")
    expect(json["preferences"]["recent_tool_ids"]).to eq([])
  end

  it "returns stored user preferences from custom fields" do
    user.custom_fields[DiscourseMechbox::UserPreferences::FIELD] = {
      unit_system: "imperial",
      favorite_layout: "list",
      recent_tool_ids: %w[gear_ratio],
    }.to_json
    user.save_custom_fields

    get "/mechbox/api/metadata"

    json = response.parsed_body
    expect(json["preferences"]["unit_system"]).to eq("imperial")
    expect(json["preferences"]["favorite_layout"]).to eq("list")
    expect(json["preferences"]["recent_tool_ids"]).to eq(%w[gear_ratio])
    expect(json["settings"]["effective_unit_system"]).to eq("imperial")
  end

  it "denies metadata for users outside allowed groups" do
    allowed_group.add(member)
    SiteSetting.mechbox_allowed_groups = allowed_group.id.to_s

    get "/mechbox/api/metadata"

    expect(response).to have_http_status(:forbidden)
  end

  it "allows metadata for users in allowed groups" do
    allowed_group.add(member)
    SiteSetting.mechbox_allowed_groups = allowed_group.id.to_s
    sign_in(member)

    get "/mechbox/api/metadata"

    expect(response).to have_http_status(:ok)
  end
end
