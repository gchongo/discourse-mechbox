# frozen_string_literal: true

module DiscourseMechbox
  class MetadataBuilder
    class << self
      def build(guardian:)
        user = guardian.user
        templates = visible_templates(guardian)

        {
          api_version: ApiCapabilities::API_VERSION,
          capabilities: ApiCapabilities.as_json,
          categories: ToolCatalog.categories_json,
          builtin_tools: ToolCatalog.builtin_tools_json,
          client_tools: ToolCatalog.client_tools_json,
          design_chains: ToolCatalog.design_chains_json,
          formula_templates: serialize_templates(templates),
          favorite_tool_ids: favorite_tool_ids(user),
          preferences: UserPreferences.fetch(user),
          settings: {
            save_calculation_records: SiteSetting.mechbox_save_calculation_records,
            max_records_per_user: SiteSetting.mechbox_max_records_per_user,
            default_unit_system: SiteSetting.mechbox_default_unit_system,
            can_manage_templates: guardian.can_manage_mechbox_templates?,
          },
        }
      end

      private

      def visible_templates(guardian)
        return [] if !DatabaseFeatures.available?

        FormulaTemplate.list_for(guardian)
      end

      def serialize_templates(templates)
        templates.map { |template| FormulaTemplateSerializer.new(template, root: false).as_json }
      end

      def favorite_tool_ids(user)
        return [] if !DatabaseFeatures.available?

        FavoriteTool.where(user_id: user.id).order(created_at: :desc).pluck(:tool_id)
      end
    end
  end
end
