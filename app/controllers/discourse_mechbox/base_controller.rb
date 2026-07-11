# frozen_string_literal: true

module DiscourseMechbox
  class BaseController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    include DiscourseMechbox::Concerns::FeatureGate

    before_action :ensure_logged_in
    before_action :ensure_can_use_mechbox
    skip_before_action :check_xhr, raise: false

    private

    def ensure_can_use_mechbox
      raise Discourse::InvalidAccess if !guardian.can_use_mechbox?
    end
  end
end
