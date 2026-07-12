# frozen_string_literal: true

require "rails_helper"

RSpec.describe "DiscourseMechbox page", type: :request do
  fab!(:user) { Fabricate(:user) }

  before do
    SiteSetting.mechbox_enabled = true
    sign_in(user)
  end

  it "redirects legacy tool URLs to the single Ember route" do
    get "/mechbox/tools/gear_ratio"

    expect(response).to redirect_to("/mechbox?tool_id=gear_ratio")
  end
end
