# frozen_string_literal: true

module DiscourseMechbox
  class MechboxPageController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    skip_before_action :check_xhr, raise: false

    def index
      raise Discourse::NotFound if !SiteSetting.mechbox_enabled

      render "default/empty"
    end
  end
end
