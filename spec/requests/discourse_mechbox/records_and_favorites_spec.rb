# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox records and favorites", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    SiteSetting.mechbox_save_calculation_records = true
    sign_in(user)
  end

  it "creates and removes favorites" do
    post "/mechbox/api/favorites", params: { tool_id: "gear_ratio" }
    expect(response).to have_http_status(:created)

    get "/mechbox/api/favorites"
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.map { |favorite| favorite["tool_id"] }).to include("gear_ratio")

    delete "/mechbox/api/favorites/gear_ratio"
    expect(response).to have_http_status(:no_content)
  end

  it "lists recently created records" do
    post "/mechbox/api/calculate",
         params: {
           tool_id: "unit_converter",
           title: "Record list smoke test",
           save_record: true,
           inputs: {
             value: 25.4,
             from_unit: "mm",
             to_unit: "in",
           },
         }
    expect(response).to have_http_status(:ok)

    get "/mechbox/api/records", params: { limit: 10 }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["records"]).not_to be_empty
    expect(response.parsed_body["meta"]["limit"]).to eq(10)
  end
end
