# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "safe_skeleton",
               status: "ok",
             }
    end

    def metadata
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "safe_skeleton",
               home_route: "/mechbox",
               api_prefix: "/mechbox/api",
               capabilities: {
                 status: true,
                 metadata: true,
               },
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
