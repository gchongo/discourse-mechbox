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

      render json: tool.merge(formula_templates: [])
    end
  end
end
