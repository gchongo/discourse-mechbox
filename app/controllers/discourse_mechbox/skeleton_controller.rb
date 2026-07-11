# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase0_5_1",
               status: "ok",
               api_version: ApiCapabilities::API_VERSION,
             }
    end

    def metadata
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase0_5_1",
               api_version: ApiCapabilities::API_VERSION,
               home_route: "/mechbox",
               api_prefix: "/mechbox/api",
               capabilities: ApiCapabilities.as_json,
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
