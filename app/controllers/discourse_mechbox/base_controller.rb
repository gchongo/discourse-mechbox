# frozen_string_literal: true

module DiscourseMechbox
  class BaseController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    before_action :ensure_logged_in
    skip_before_action :check_xhr, raise: false

    private

    def require_api_feature!(feature)
      return true if DiscourseMechbox::ApiCapabilities.enabled?(feature)

      render_json_error(
        I18n.t("mechbox.errors.feature_not_available", feature:),
        status: 501,
      )
      false
    end
  end
end
