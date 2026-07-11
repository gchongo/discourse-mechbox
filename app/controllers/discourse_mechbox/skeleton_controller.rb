# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase0_5_4",
               status: "ok",
               api_version: ApiCapabilities::API_VERSION,
               database_available: DatabaseFeatures.available?,
               builtin_tool_count: ToolCatalog.builtin_tool_ids.size,
             }
    end

    def metadata
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "phase0_5_4",
               api_version: ApiCapabilities::API_VERSION,
               home_route: "/mechbox",
               api_prefix: "/mechbox/api",
               database_available: DatabaseFeatures.available?,
               capabilities: ApiCapabilities.as_json,
               categories: ToolCatalog.categories_json,
               builtin_tools: ToolCatalog.builtin_tools_json,
               client_tools: ToolCatalog.client_tools_json,
               design_chains: ToolCatalog.design_chains_json,
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
