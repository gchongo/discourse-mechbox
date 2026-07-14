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

    # Metric coarse pitch defaults (mm), aligned with MechBox METRIC_THREAD_PITCH.
    METRIC_THREAD_PITCH = {
      3 => 0.5,
      4 => 0.7,
      5 => 0.8,
      6 => 1.0,
      8 => 1.25,
      10 => 1.5,
      12 => 1.75,
      14 => 2.0,
      16 => 2.0,
      18 => 2.5,
      20 => 2.5,
      22 => 2.5,
      24 => 3.0,
      27 => 3.0,
      30 => 3.5,
    }.freeze

    # Allowable tensile stress (MPa), aligned with MechBox THREAD_GRADES.
    BOLT_GRADES = {
      "4.6" => { allow_stress: 160.0 },
      "4.8" => { allow_stress: 200.0 },
      "5.6" => { allow_stress: 190.0 },
      "8.8" => { allow_stress: 400.0 },
      "10.9" => { allow_stress: 560.0 },
      "12.9" => { allow_stress: 630.0 },
    }.freeze

    # Simplified bolt preload: T = K · F · d, plus tensile stress check.
    def self.calculate_bolt_clamp_load(inputs)
      mode = inputs["mode"].to_s.presence || "torque2force"
      grade = inputs["grade"].to_s.presence || "8.8"
      nut_factor = numeric_input(inputs, "nut_factor")
      nominal_diameter_mm = numeric_input(inputs, "nominal_diameter_mm")

      if nut_factor <= 0 || nominal_diameter_mm <= 0
        raise Error, I18n.t("mechbox.errors.positive_values_required")
      end

      grade_meta = BOLT_GRADES[grade]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "grade") if grade_meta.blank?

      pitch_mm =
        if inputs["pitch_mm"].present?
          numeric_input(inputs, "pitch_mm")
        else
          METRIC_THREAD_PITCH[nominal_diameter_mm.round] || 1.5
        end
      raise Error, I18n.t("mechbox.errors.positive_values_required") if pitch_mm <= 0

      case mode
      when "torque2force"
        torque_nm = numeric_input(inputs, "torque_nm")
        raise Error, I18n.t("mechbox.errors.positive_values_required") if torque_nm <= 0

        preload_n = torque_nm / (nut_factor * nominal_diameter_mm / 1000.0)
      when "force2torque"
        preload_n = numeric_input(inputs, "preload_n")
        raise Error, I18n.t("mechbox.errors.positive_values_required") if preload_n <= 0

        torque_nm = nut_factor * preload_n * nominal_diameter_mm / 1000.0
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "mode")
      end

      # As ≈ π/4 · (d - 0.9382·P)^2  (MechBox calcTensileStressArea)
      pitch_diameter = nominal_diameter_mm - 0.9382 * pitch_mm
      stress_area_mm2 = (Math::PI / 4.0) * (pitch_diameter**2)
      allow_stress_mpa = grade_meta[:allow_stress]
      stress_mpa = stress_area_mm2.positive? ? preload_n / stress_area_mm2 : 0.0
      max_preload_n = allow_stress_mpa * stress_area_mm2
      pass = preload_n.positive? && stress_mpa <= allow_stress_mpa

      {
        "mode" => mode,
        "grade" => grade,
        "pitch_mm" => pitch_mm,
        "preload_n" => preload_n,
        "preload_kn" => preload_n / 1000.0,
        "torque_nm" => torque_nm,
        "stress_area_mm2" => stress_area_mm2,
        "stress_mpa" => stress_mpa,
        "allow_stress_mpa" => allow_stress_mpa,
        "max_preload_n" => max_preload_n,
        "pass" => pass,
        "estimate_only" => true,
      }
    end

    def self.calculate_gdt_position(inputs)
      deviation_x_mm = numeric_input(inputs, "deviation_x_mm")
      deviation_y_mm = numeric_input(inputs, "deviation_y_mm")
      position_diameter_mm = 2.0 * Math.sqrt(deviation_x_mm**2 + deviation_y_mm**2)

      { "position_diameter_mm" => position_diameter_mm }
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
