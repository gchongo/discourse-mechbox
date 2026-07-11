# frozen_string_literal: true

module DiscourseMechbox
  class MetadataBuilder
    def self.build(guardian:)
      user = guardian.user

      {
        plugin: DiscourseMechbox::PLUGIN_NAME,
        mode: "phase1_3",
        api_version: ApiCapabilities::API_VERSION,
        home_route: "/mechbox",
        api_prefix: "/mechbox/api",
        database_available: DatabaseFeatures.available?,
        capabilities: ApiCapabilities.as_json,
        categories: ToolCatalog.categories_json,
        builtin_tools: ToolCatalog.builtin_tools_json,
        client_tools: ToolCatalog.client_tools_json,
        design_chains: ToolCatalog.design_chains_json,
        formula_templates: [],
        favorite_tool_ids: [],
        preferences: UserPreferences.fetch(user),
        settings: {
          save_calculation_records: SiteSetting.mechbox_save_calculation_records,
          max_records_per_user: SiteSetting.mechbox_max_records_per_user,
          default_unit_system: SiteSetting.mechbox_default_unit_system,
          effective_unit_system: UserPreferences.effective_unit_system(user),
          can_manage_templates: guardian.can_manage_mechbox_templates?,
        },
      }
    end
  end
end
