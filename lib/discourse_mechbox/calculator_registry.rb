# frozen_string_literal: true

module DiscourseMechbox
  class CalculatorRegistry
    class Error < StandardError
    end

    BUILTIN_TOOL_IDS = %w[
      unit_converter
      rss_calculation
      gear_ratio
      bolt_clamp_load
      gdt_position
      thread
      key
      bolt_group
      weld
      spring
      clutch
      belt
      chain
      tol_convert
      sigma_analysis
      fit
      distribution_chart
      thermal_expansion
      interference_fit
    ].freeze

    UNIT_FACTORS = {
      "mm" => { dimension: "length", factor: 0.001 },
      "cm" => { dimension: "length", factor: 0.01 },
      "m" => { dimension: "length", factor: 1.0 },
      "in" => { dimension: "length", factor: 0.0254 },
      "ft" => { dimension: "length", factor: 0.3048 },
      "mpa" => { dimension: "pressure", factor: 1_000_000.0 },
      "psi" => { dimension: "pressure", factor: 6894.757293 },
      "n" => { dimension: "force", factor: 1.0 },
      "lbf" => { dimension: "force", factor: 4.4482216153 },
      "rpm" => { dimension: "speed", factor: 1.0 },
    }.freeze

    def self.calculate(tool_id:, inputs:, formula_template: nil)
      if formula_template
        return calculate_template(inputs:, formula_template:)
      end

      raise Error, I18n.t("mechbox.errors.unknown_tool") if BUILTIN_TOOL_IDS.exclude?(tool_id)

      public_send(:"calculate_#{tool_id}", inputs.to_h)
    end

    def self.calculate_template(inputs:, formula_template:)
      evaluator = FormulaEvaluator.new(inputs)
      outputs =
        formula_template
          .formula
          .fetch("outputs", {})
          .each_with_object({}) do |(name, expression), result|
            result[name] = evaluator.evaluate(expression.to_s)
          end

      {
        "tool_id" => formula_template.tool_id,
        "template_id" => formula_template.id,
        "outputs" => outputs,
      }
    rescue KeyError
      raise Error, I18n.t("mechbox.errors.invalid_template_formula")
    end

    def self.calculate_unit_converter(inputs)
      value = numeric_input(inputs, "value")
      from_unit = inputs["from_unit"].to_s.downcase
      to_unit = inputs["to_unit"].to_s.downcase

      from = UNIT_FACTORS[from_unit]
      to = UNIT_FACTORS[to_unit]
      raise Error, I18n.t("mechbox.errors.unknown_unit") if from.blank? || to.blank?
      raise Error, I18n.t("mechbox.errors.incompatible_units") if from[:dimension] != to[:dimension]

      converted = value * from[:factor] / to[:factor]

      { "converted_value" => converted, "from_unit" => from_unit, "to_unit" => to_unit }
    end

    def self.calculate_rss_calculation(inputs)
      values = array_input(inputs, "values")
      raise Error, I18n.t("mechbox.errors.empty_values") if values.empty?

      rss = Math.sqrt(values.sum { |value| value**2 })

      { "rss" => rss, "count" => values.length }
    end

    def self.calculate_gear_ratio(inputs)
      driver_teeth = numeric_input(inputs, "driver_teeth")
      driven_teeth = numeric_input(inputs, "driven_teeth")
      input_speed_rpm = numeric_input(inputs, "input_speed_rpm")

      raise Error, I18n.t("mechbox.errors.positive_values_required") if driver_teeth <= 0 || driven_teeth <= 0

      ratio = driven_teeth / driver_teeth
      output_speed_rpm = input_speed_rpm / ratio

      { "ratio" => ratio, "output_speed_rpm" => output_speed_rpm }
    end

    def self.calculate_bolt_clamp_load(inputs)
      DiscourseMechbox::BoltPreloadCalculator.calculate(inputs)
    rescue DiscourseMechbox::BoltPreloadCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_thread(inputs)
      DiscourseMechbox::ThreadCalculator.calculate(inputs)
    rescue DiscourseMechbox::ThreadCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_key(inputs)
      DiscourseMechbox::KeyCalculator.calculate(inputs)
    rescue DiscourseMechbox::KeyCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_bolt_group(inputs)
      DiscourseMechbox::BoltGroupCalculator.calculate(inputs)
    rescue DiscourseMechbox::BoltGroupCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_weld(inputs)
      DiscourseMechbox::WeldCalculator.calculate(inputs)
    rescue DiscourseMechbox::WeldCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_spring(inputs)
      DiscourseMechbox::SpringCalculator.calculate(inputs)
    rescue DiscourseMechbox::SpringCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_clutch(inputs)
      DiscourseMechbox::ClutchCalculator.calculate(inputs)
    rescue DiscourseMechbox::ClutchCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_belt(inputs)
      DiscourseMechbox::BeltCalculator.calculate(inputs)
    rescue DiscourseMechbox::BeltCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_chain(inputs)
      DiscourseMechbox::ChainCalculator.calculate(inputs)
    rescue DiscourseMechbox::ChainCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_tol_convert(inputs)
      DiscourseMechbox::TolConvertCalculator.calculate(inputs)
    rescue DiscourseMechbox::TolConvertCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_sigma_analysis(inputs)
      DiscourseMechbox::SigmaAnalysisCalculator.calculate(inputs)
    rescue DiscourseMechbox::SigmaAnalysisCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_fit(inputs)
      DiscourseMechbox::FitCalculator.calculate(inputs)
    rescue DiscourseMechbox::FitCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_distribution_chart(inputs)
      DiscourseMechbox::DistributionChartCalculator.calculate(inputs)
    rescue DiscourseMechbox::DistributionChartCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_thermal_expansion(inputs)
      DiscourseMechbox::ThermalExpansionCalculator.calculate(inputs)
    rescue DiscourseMechbox::ThermalExpansionCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_interference_fit(inputs)
      DiscourseMechbox::InterferenceFitCalculator.calculate(inputs)
    rescue DiscourseMechbox::InterferenceFitCalculator::Error => error
      raise Error, error.message
    end

    def self.calculate_gdt_position(inputs)
      deviation_x_mm = numeric_input(inputs, "deviation_x_mm")
      deviation_y_mm = numeric_input(inputs, "deviation_y_mm")
      position_diameter_mm = 2.0 * Math.sqrt(deviation_x_mm**2 + deviation_y_mm**2)

      outputs = { "position_diameter_mm" => position_diameter_mm }

      if inputs["tolerance_diameter_mm"].present?
        tolerance = numeric_input(inputs, "tolerance_diameter_mm")
        raise Error, I18n.t("mechbox.errors.positive_values_required") if tolerance <= 0

        outputs["tolerance_diameter_mm"] = tolerance
        outputs["margin_mm"] = tolerance - position_diameter_mm
        outputs["utilization"] = position_diameter_mm / tolerance
        outputs["pass"] = position_diameter_mm <= tolerance
      end

      outputs
    end

    def self.numeric_input(inputs, key)
      Float(inputs[key])
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def self.array_input(inputs, key)
      raw = inputs[key]
      values = raw.is_a?(Array) ? raw : raw.to_s.split(",")
      values.map { |value| Float(value) }
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end
  end
end
