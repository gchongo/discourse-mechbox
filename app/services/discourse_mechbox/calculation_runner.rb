# frozen_string_literal: true

module DiscourseMechbox
  class CalculationRunner
    class << self
      def run(guardian:, params:, persist: true)
        tool_id = params[:tool_id].to_s
        inputs = normalize_inputs(params[:inputs])
        unit_system = params[:unit_system].presence || UserPreferences.effective_unit_system(guardian.user)
        formula_template = resolve_template(guardian:, template_id: params[:formula_template_id])

        if formula_template
          tool_id = formula_template.tool_id
        elsif CalculatorRegistry::BUILTIN_TOOL_IDS.exclude?(tool_id)
          raise CalculatorRegistry::Error, I18n.t("mechbox.errors.unknown_tool")
        end

        raw_result =
          CalculatorRegistry.calculate(
            tool_id:,
            inputs:,
            formula_template:,
          )

        outputs, resolved_tool_id, template_id = normalize_result(raw_result, tool_id, formula_template)

        record = nil
        if persist && truthy?(params[:save_record]) && SiteSetting.mechbox_save_calculation_records &&
             DatabaseFeatures.available?
          record =
            RecordCreator.create!(
              user: guardian.user,
              tool_id: resolved_tool_id,
              formula_template:,
              title: params[:title],
              inputs:,
              outputs:,
              unit_system:,
            )
        end

        {
          tool_id: resolved_tool_id,
          template_id:,
          outputs:,
          unit_system:,
          record_id: record&.id,
        }
      end

      def validate_only(guardian:, params:)
        run(guardian:, params:, persist: false)
      end

      private

      def resolve_template(guardian:, template_id:)
        return if template_id.blank?

        template = FormulaTemplate.active.find_by(id: template_id)
        raise Discourse::NotFound if template.blank?
        raise Discourse::InvalidAccess if !guardian.can_use_mechbox_template?(template)

        template
      end

      def normalize_inputs(raw)
        case raw
        when ActionController::Parameters
          raw.to_unsafe_h
        when Hash
          raw
        else
          {}
        end
      end

      def truthy?(value)
        ActiveModel::Type::Boolean.new.cast(value)
      end

      def normalize_result(result, tool_id, formula_template)
        if result.is_a?(Hash) && result.key?("outputs")
          [result["outputs"], result["tool_id"] || tool_id, result["template_id"] || formula_template&.id]
        else
          [result, tool_id, formula_template&.id]
        end
      end
    end
  end
end
