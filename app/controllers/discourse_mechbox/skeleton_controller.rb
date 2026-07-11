# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase1_catalog",
               status: "ok",
             }
    end

    def not_implemented
      feature = params[:feature].presence || request.path
      render_json_error(
        I18n.t("mechbox.errors.feature_not_available", feature:),
        status: 501,
      )
    end
  end
end
