# frozen_string_literal: true

module DiscourseMechbox
  class MechboxPageController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    before_action :ensure_logged_in
    skip_before_action :check_xhr, raise: false

    def index
      raise Discourse::NotFound if !SiteSetting.mechbox_enabled
      raise Discourse::InvalidAccess unless guardian.can_use_mechbox?

      render "default/empty"
    end
  end
end
