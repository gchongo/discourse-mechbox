# frozen_string_literal: true

module DiscourseMechbox
  class SkeletonController < BaseController
    FUTURE_INTERFACES = [
      "tools_index",
      "tools_show",
      "calculate",
      "calculate_validate",
      "records_search",
      "records_bulk_destroy",
      "records_index",
      "records_show",
      "records_destroy",
      "favorites_index",
      "favorites_create",
      "favorites_destroy",
      "templates_index",
      "templates_create",
      "template_versions_index",
      "template_versions_show",
      "templates_show",
      "templates_update",
      "templates_destroy",
      "preferences_show",
      "preferences_update",
      "client_tools_validate",
      "client_tools_calculate",
      "exports_create",
      "exports_show",
      "topic_drafts_create",
      "projects_index",
      "projects_create",
      "projects_show",
      "projects_update",
      "projects_destroy",
      "admin_stats",
    ].freeze

    def status
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "skeleton",
               status: "ok",
             }
    end

    def metadata
      render json: {
               plugin: DiscourseMechbox::PLUGIN_NAME,
               mode: "skeleton",
               home_route: "/mechbox",
               api_prefix: "/mechbox/api",
               capabilities: {
                 status: true,
                 metadata: true,
               },
               future_interfaces: FUTURE_INTERFACES,
             }
    end

    def not_implemented
      render_json_error(
        I18n.t("mechbox.errors.feature_not_available", feature: params[:feature] || request.path),
        status: 501,
      )
    end
  end
end
