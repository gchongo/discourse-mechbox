# frozen_string_literal: true

module DiscourseMechbox
  # Shaft torsion / combined bending-torsion strength.
  # Ported from MechBox/src/utils/shaft-calc.js + shaft-combined.js.
  # Units: torque & bending moment N·m; diameter/length mm; stress & G/E MPa.
  # Professional mode applies Kt peak checks; full SN fatigue is not released here.
  class ShaftCalculator
    class Error < StandardError
    end

    MATERIALS = {
      "q235" => {
        name: "Q235",
        e: 206_000.0,
        g: 79_000.0,
        sigma_allow: 157.0,
        tau_allow: 94.0,
        sigma_s: 235.0,
      },
      "q345" => {
        name: "Q345",
        e: 206_000.0,
        g: 79_000.0,
        sigma_allow: 230.0,
        tau_allow: 138.0,
        sigma_s: 345.0,
      },
      "45" => {
        name: "45",
        e: 206_000.0,
        g: 79_000.0,
        sigma_allow: 237.0,
        tau_allow: 142.0,
        sigma_s: 355.0,
      },
      "40cr" => {
        name: "40Cr",
        e: 206_000.0,
        g: 79_000.0,
        sigma_allow: 523.0,
        tau_allow: 314.0,
        sigma_s: 785.0,
      },
      "42crmo" => {
        name: "42CrMo",
        e: 206_000.0,
        g: 79_000.0,
        sigma_allow: 620.0,
        tau_allow: 372.0,
        sigma_s: 930.0,
      },
      "304" => {
        name: "304",
        e: 193_000.0,
        g: 77_000.0,
        sigma_allow: 137.0,
        tau_allow: 82.0,
        sigma_s: 205.0,
      },
    }.freeze

    ANALYSIS_MODES = %w[torsion combined].freeze
    STRENGTH_THEORIES = %w[vonMises third].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      analysis_mode =
        normalize_analysis(@inputs["analysis_mode"] || @inputs["analysisMode"] || "torsion")

      diameter = positive_number("diameter_mm", aliases: %w[diameter])
      inner =
        if calc_mode == "simple"
          0.0
        else
          optional_number("inner_diameter_mm", aliases: %w[innerDiameter inner_diameter]) || 0.0
        end
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "inner_diameter_mm") if inner < 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "inner_diameter_mm") if inner >= diameter

      torque = number_or_zero("torque_nm", aliases: %w[torque])
      raise Error, I18n.t("mechbox.errors.positive_values_required") if torque < 0

      material_id = (@inputs["material_id"] || @inputs["materialId"]).to_s.presence
      material = material_id && MATERIALS[material_id]

      if analysis_mode == "torsion"
        calculate_torsion(calc_mode:, diameter:, inner:, torque:, material_id:, material:)
      else
        calculate_combined(calc_mode:, diameter:, inner:, torque:, material_id:, material:)
      end
    end

    private

    def calculate_torsion(calc_mode:, diameter:, inner:, torque:, material_id:, material:)
      length =
        optional_number("length_mm", aliases: %w[length shaftLength]) || 500.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if length <= 0

      g =
        optional_number("shear_modulus_mpa", aliases: %w[shearModulus G]) ||
          material&.dig(:g) ||
          79_000.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if g <= 0

      allow =
        optional_number("allowable_shear_mpa", aliases: %w[allowableShear allowable]) ||
          material&.dig(:tau_allow)
      if allow.nil? && calc_mode != "simple"
        yield_s =
          optional_number("yield_strength_mpa", aliases: %w[yieldStrength]) ||
            material&.dig(:sigma_s)
        allow = yield_s && (0.5 * yield_s)
      end
      if allow.nil?
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "material_id")
      end
      raise Error, I18n.t("mechbox.errors.positive_values_required") if allow <= 0

      tau = torsion_stress(torque, diameter, inner)
      theta = torsion_angle(torque, length, diameter, g, inner)
      d_min = min_diameter_for_torque(torque, allow, inner)

      max_twist =
        optional_number("max_twist_angle_deg", aliases: %w[maxTwistAngle max_twist_angle])

      torsion_pass = tau <= allow
      angle_pass = max_twist.nil? || theta <= max_twist
      pass =
        if calc_mode == "simple"
          torsion_pass
        else
          torsion_pass && angle_pass
        end

      result = {
        "calc_mode" => calc_mode,
        "analysis_mode" => "torsion",
        "material_id" => material_id,
        "material_name" => material&.dig(:name),
        "diameter_mm" => round(diameter, 3),
        "inner_diameter_mm" => round(inner, 3),
        "hollow_shaft" => inner > 0,
        "torque_nm" => round(torque, 3),
        "length_mm" => round(length, 3),
        "shear_stress_mpa" => round(tau, 3),
        "twist_angle_deg" => round(theta, 5),
        "polar_moment_mm4" => round(polar_moment(diameter, inner), 3),
        "min_diameter_mm" => round(d_min, 2),
        "allowable_shear_mpa" => round(allow, 3),
        "utilization" => round(tau / allow, 4),
        "torsion_pass" => torsion_pass,
        "angle_pass" => angle_pass,
        "pass" => pass,
        "estimate_only" => calc_mode == "simple",
      }

      if calc_mode == "professional"
        kt =
          optional_number(
            "stress_concentration_torsion",
            aliases: %w[stressConcentrationTorsion kt_torsion],
          ) || 1.0
        raise Error, I18n.t("mechbox.errors.positive_values_required") if kt < 1

        peak = tau * kt
        peak_pass = peak <= allow
        result["stress_concentration_torsion"] = round(kt, 3)
        result["peak_shear_stress_mpa"] = round(peak, 3)
        result["peak_pass"] = peak_pass
        result["pass"] = pass && peak_pass
        result["estimate_only"] = false
        result["fatigue_released"] = false
      end

      result
    end

    def calculate_combined(calc_mode:, diameter:, inner:, torque:, material_id:, material:)
      bending =
        number_or_zero("bending_moment_nm", aliases: %w[bendingMoment bending_moment])
      raise Error, I18n.t("mechbox.errors.positive_values_required") if bending < 0

      theory =
        normalize_theory(
          @inputs["strength_theory"] || @inputs["strengthTheory"] || "vonMises",
        )

      allow =
        optional_number("allowable_stress_mpa", aliases: %w[allowableStress allowable]) ||
          material&.dig(:sigma_allow)
      if allow.nil?
        allow =
          optional_number("yield_strength_mpa", aliases: %w[yieldStrength]) ||
            material&.dig(:sigma_s)
      end
      if allow.nil? && calc_mode == "simple"
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "material_id")
      end
      allow ||= 235.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if allow <= 0

      sigma = bending_stress(bending, diameter, inner)
      tau = torsion_stress(torque, diameter, inner)

      if calc_mode == "professional"
        kt_b =
          optional_number(
            "stress_concentration_bending",
            aliases: %w[stressConcentrationBending kt_bending],
          ) || 1.0
        kt_t =
          optional_number(
            "stress_concentration_torsion",
            aliases: %w[stressConcentrationTorsion kt_torsion],
          ) || 1.0
        raise Error, I18n.t("mechbox.errors.positive_values_required") if kt_b < 1 || kt_t < 1
        sigma *= kt_b
        tau *= kt_t
      end

      equiv = equivalent_stress(sigma, tau, theory)
      torsion_allow = theory == "third" ? allow / 2.0 : allow / Math.sqrt(3)

      bending_pass = sigma <= allow
      torsion_pass = tau <= torsion_allow
      combined_pass = equiv <= allow
      pass =
        if calc_mode == "simple"
          combined_pass
        else
          combined_pass
        end

      result = {
        "calc_mode" => calc_mode,
        "analysis_mode" => "combined",
        "material_id" => material_id,
        "material_name" => material&.dig(:name),
        "diameter_mm" => round(diameter, 3),
        "inner_diameter_mm" => round(inner, 3),
        "hollow_shaft" => inner > 0,
        "torque_nm" => round(torque, 3),
        "bending_moment_nm" => round(bending, 3),
        "strength_theory" => theory,
        "bending_stress_mpa" => round(sigma, 3),
        "shear_stress_mpa" => round(tau, 3),
        "equivalent_stress_mpa" => round(equiv, 3),
        "allowable_stress_mpa" => round(allow, 3),
        "torsion_allowable_mpa" => round(torsion_allow, 3),
        "utilization" => round(equiv / allow, 4),
        "bending_pass" => bending_pass,
        "torsion_pass" => torsion_pass,
        "combined_pass" => combined_pass,
        "pass" => pass,
        "estimate_only" => calc_mode == "simple",
      }

      if calc_mode == "professional"
        result["stress_concentration_bending"] = round(
          optional_number(
            "stress_concentration_bending",
            aliases: %w[stressConcentrationBending kt_bending],
          ) || 1.0,
          3,
        )
        result["stress_concentration_torsion"] = round(
          optional_number(
            "stress_concentration_torsion",
            aliases: %w[stressConcentrationTorsion kt_torsion],
          ) || 1.0,
          3,
        )
        result["estimate_only"] = false
        result["fatigue_released"] = false
      end

      result
    end

    def polar_moment(diameter, inner)
      if inner > 0 && inner < diameter
        Math::PI * (diameter**4 - inner**4) / 32.0
      else
        Math::PI * (diameter**4) / 32.0
      end
    end

    def section_modulus_bending(diameter, inner)
      if inner > 0 && inner < diameter
        Math::PI * (diameter**4 - inner**4) / (32.0 * diameter)
      else
        Math::PI * (diameter**3) / 32.0
      end
    end

    def torsion_stress(torque_nm, diameter, inner)
      j = polar_moment(diameter, inner)
      return 0.0 if j <= 0

      (torque_nm * 1000.0 * (diameter / 2.0)) / j
    end

    def torsion_angle(torque_nm, length_mm, diameter, g, inner)
      j = polar_moment(diameter, inner)
      return 0.0 if j <= 0 || g <= 0

      ((torque_nm * 1000.0 * length_mm) / (g * j)) * (180.0 / Math::PI)
    end

    def bending_stress(moment_nm, diameter, inner)
      w = section_modulus_bending(diameter, inner)
      return 0.0 if w <= 0

      (moment_nm * 1000.0) / w
    end

    def equivalent_stress(bending, torsion, theory)
      if theory == "third"
        Math.sqrt(bending**2 + 4.0 * torsion**2)
      else
        Math.sqrt(bending**2 + 3.0 * torsion**2)
      end
    end

    def min_diameter_for_torque(torque_nm, allow, inner)
      return 0.0 if allow <= 0

      tnmm = torque_nm * 1000.0
      if inner > 0
        d = [inner + 1.0, 10.0].max
        80.times do
          return d if torsion_stress(torque_nm, d, inner) <= allow

          d += 1.0
        end
        d
      else
        Math.cbrt((16.0 * tnmm) / (Math::PI * allow))
      end
    end

    def normalize_mode(raw)
      mode = raw.to_s
      return mode if %w[simple full professional].include?(mode)
      return "full" if mode == "complete"

      "simple"
    end

    def normalize_analysis(raw)
      mode = raw.to_s
      return mode if ANALYSIS_MODES.include?(mode)

      "torsion"
    end

    def normalize_theory(raw)
      theory = raw.to_s
      return theory if STRENGTH_THEORIES.include?(theory)
      return "third" if theory == "tresca"

      "vonMises"
    end

    def positive_number(key, aliases: [])
      value = optional_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil? || value <= 0

      value
    end

    def number_or_zero(key, aliases: [])
      optional_number(key, aliases:) || 0.0
    end

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? }
      return nil if raw.nil? || raw.to_s.strip.empty?

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def round(value, digits)
      value.round(digits)
    end
  end
end
