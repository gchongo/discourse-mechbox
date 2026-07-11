# frozen_string_literal: true

module DiscourseMechbox
  class ToolsController < BaseController
    def index
      return unless require_api_feature!(:tools)

      render json: {
        categories: ToolCatalog.categories_json,
        builtin_tools: ToolCatalog.builtin_tools_json,
        client_tools: ToolCatalog.client_tools_json,
        design_chains: ToolCatalog.design_chains_json,
      }
    end

    def show
      return unless require_api_feature!(:tools)

      tool = ToolCatalog.tool_summary(params[:tool_id])
      raise Discourse::NotFound if tool.blank?

      render json: tool.merge(formula_templates: formula_templates_for(params[:tool_id]))
    end

    private

    def formula_templates_for(tool_id)
      return [] if !DatabaseFeatures.available?

      require_relative "../../models/discourse_mechbox/formula_template"
      require_relative "../../serializers/discourse_mechbox/formula_template_serializer"

      FormulaTemplate
        .list_for(guardian)
        .where(tool_id:)
        .map { |template| FormulaTemplateSerializer.new(template, root: false).as_json }
    rescue StandardError
      []
    end
  end
end
