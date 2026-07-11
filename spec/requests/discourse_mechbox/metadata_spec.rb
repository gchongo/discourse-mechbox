# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox metadata", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "returns the Phase 0.5.8 catalog contract" do
    get "/mechbox/api/metadata"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["mode"]).to eq("phase0_5_8")
    expect(json["api_version"]).to eq(1)
    expect(json["capabilities"]["metadata"]["enabled"]).to eq(true)
    expect(json["capabilities"]["tools"]["enabled"]).to eq(true)
    expect(json["capabilities"]["calculate"]["enabled"]).to eq(false)
    expect(json["capabilities"]["records_index"]["enabled"]).to eq(false)
    expect(json["capabilities"]["favorites"]["enabled"]).to eq(false)
    expect(json["settings"]["default_unit_system"]).to be_present
    expect(json["settings"]["effective_unit_system"]).to eq("metric")
    expect(json["builtin_tools"].size).to eq(5)
    expect(json["categories"]).to be_present
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
end
