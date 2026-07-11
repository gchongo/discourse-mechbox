# frozen_string_literal: true

module DiscourseMechbox
  class MetadataBuilder
    class << self
      def build(guardian:)
        user = guardian.user

        {
          api_version: ApiCapabilities::API_VERSION,
          capabilities: ApiCapabilities.as_json,
          categories: ToolCatalog.categories_json,
          builtin_tools: ToolCatalog.builtin_tools_json,
          client_tools: ToolCatalog.client_tools_json,
          design_chains: ToolCatalog.design_chains_json,
          formula_templates: serialize_templates(visible_templates(guardian)),
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

        load_db_models!
        FormulaTemplate.list_for(guardian)
      rescue StandardError
        []
      end

      def serialize_templates(templates)
        return [] if templates.blank?

        load_db_models!
        templates.map { |template| FormulaTemplateSerializer.new(template, root: false).as_json }
      rescue StandardError
        []
      end

      def favorite_tool_ids(user)
        return [] if !DatabaseFeatures.available?

        load_db_models!
        FavoriteTool.where(user_id: user.id).order(created_at: :desc).pluck(:tool_id)
      rescue StandardError
        []
      end

      def load_db_models!
        return if defined?(DiscourseMechbox::FormulaTemplate)

        require_relative "../../models/discourse_mechbox/formula_template"
        require_relative "../../models/discourse_mechbox/template_version"
        require_relative "../../models/discourse_mechbox/favorite_tool"
        require_relative "../../serializers/discourse_mechbox/formula_template_serializer"
      end
    end
  end
end
