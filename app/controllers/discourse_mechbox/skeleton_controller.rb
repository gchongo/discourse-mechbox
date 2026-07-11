# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase0_5_8",
               status: "ok",
               api_version: ApiCapabilities::API_VERSION,
               database_available: DatabaseFeatures.available?,
               builtin_tool_count: ToolCatalog.builtin_tool_ids.size,
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
