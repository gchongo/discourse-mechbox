# frozen_string_literal: true

module DiscourseMechbox
  class BaseController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    before_action :ensure_logged_in
    skip_before_action :check_xhr, raise: false
  end
end
