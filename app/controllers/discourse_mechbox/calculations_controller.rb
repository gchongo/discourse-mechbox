# frozen_string_literal: true

module DiscourseMechbox
  class CalculationsController < BaseController
    def create
      result = CalculationRunner.run(guardian:, params: calculation_params, persist: true)
      render json: result
    end

    def validate
      return unless require_api_feature!(:calculate_validate)

      result = CalculationRunner.validate_only(guardian:, params: calculation_params)
      render json: result.merge(valid: true)
    end

    private

    def calculation_params
      params.permit(
        :tool_id,
        :formula_template_id,
        :unit_system,
        :save_record,
        :title,
        inputs: {},
      )
    end
  end
end
