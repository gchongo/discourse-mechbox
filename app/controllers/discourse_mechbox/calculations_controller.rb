# frozen_string_literal: true

module DiscourseMechbox
  class CalculationsController < BaseController
    def create
      return unless require_api_feature!(:calculate)

      result = CalculationRunner.run(guardian:, params: calculation_params, persist: true)
      render json: result
    rescue CalculatorRegistry::Error, FormulaEvaluator::Error => error
      render_json_error(error.message, status: 422)
    end

    def validate
      return unless require_api_feature!(:calculate_validate)

      result = CalculationRunner.validate_only(guardian:, params: calculation_params)
      render json: result.merge(valid: true)
    rescue CalculatorRegistry::Error, FormulaEvaluator::Error => error
      render_json_error(error.message, status: 422)
    end

    private

    def calculation_params
      permitted =
        params.permit(:tool_id, :formula_template_id, :unit_system, :save_record, :title)

      if params[:inputs].present?
        raw = params[:inputs]
        permitted[:inputs] =
          if raw.respond_to?(:to_unsafe_h)
            raw.to_unsafe_h
          elsif raw.is_a?(Hash)
            raw
          else
            {}
          end
      end

      permitted
    end
  end
end
