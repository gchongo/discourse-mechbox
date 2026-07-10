# frozen_string_literal: true

module DiscourseMechbox
  module Admin
    class StatsController < BaseController
      before_action :ensure_admin

      def show
        return unless require_api_feature!(:admin_stats)

        render json: {
          calculation_records_count: CalculationRecord.count,
          formula_templates_count: FormulaTemplate.count,
          active_formula_templates_count: FormulaTemplate.active.count,
          favorite_tools_count: FavoriteTool.count,
          builtin_tools_count: ToolCatalog.builtin_tool_ids.size,
          client_tools_count: ToolCatalog.client_tool_ids.size,
        }
      end

      private

      def ensure_admin
        raise Discourse::InvalidAccess if !guardian.is_admin?
      end
    end
  end
end
