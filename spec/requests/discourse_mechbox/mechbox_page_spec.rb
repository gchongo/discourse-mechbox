# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox page", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "serves the Ember shell for tool URLs" do
    get "/mechbox/tools/gear_ratio"

    expect(response).to have_http_status(:ok)
  end
end
