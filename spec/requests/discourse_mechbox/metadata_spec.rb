# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox metadata", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "returns the MVP bootstrap contract" do
    get "/mechbox/api/metadata"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body

    expect(json["api_version"]).to eq(1)
    expect(json["capabilities"]["metadata"]["enabled"]).to eq(true)
    expect(json["capabilities"]["tools"]["enabled"]).to eq(true)
    expect(json["capabilities"]["calculate"]["enabled"]).to eq(true)
    expect(json["capabilities"]["records_index"]["enabled"]).to eq(true)
    expect(json["capabilities"]["favorites"]["enabled"]).to eq(true)
    expect(json["settings"]["default_unit_system"]).to be_present
    expect(json["builtin_tools"]).to be_an(Array)
    expect(json["categories"]).to be_an(Array)
  end
end
