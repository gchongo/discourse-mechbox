# frozen_string_literal: true

module DiscourseMechbox
  class ExportsController < BaseController
    def create
      return unless require_api_feature!(:exports)

      render_json_error I18n.t("mechbox.errors.exports_not_implemented"), status: 501
    end

    def show
      return unless require_api_feature!(:exports)

      render_json_error I18n.t("mechbox.errors.exports_not_implemented"), status: 501
    end
  end
end
