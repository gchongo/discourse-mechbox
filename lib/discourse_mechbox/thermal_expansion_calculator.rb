# frozen_string_literal: true

module DiscourseMechbox
  # Thermal expansion: linear growth + fit change under temperature.
  # Ported from MechBox/src/utils/thermal-expansion-calc.js.
  class ThermalExpansionCalculator
    class Error < StandardError
    end

    REFERENCE_TEMP = 20.0

    # alpha in 1/°C; alpha_temp_coeff drives the professional α(T) correction.
    MATERIALS = {
      "steel" => { alpha: 11.5e-6, alpha_temp_coeff: 2.4e-5 },
      "stainless" => { alpha: 17.3e-6, alpha_temp_coeff: 2.2e-5 },
      "cast_iron" => { alpha: 10.5e-6, alpha_temp_coeff: 2.0e-5 },
      "aluminum" => { alpha: 23.6e-6, alpha_temp_coeff: 3.0e-5 },
      "copper" => { alpha: 17.0e-6, alpha_temp_coeff: 2.5e-5 },
      "brass" => { alpha: 18.7e-6, alpha_temp_coeff: 2.6e-5 },
      "titanium" => { alpha: 8.6e-6, alpha_temp_coeff: 1.8e-5 },
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])

      material1 = normalize_material(@inputs["material"] || @inputs["material1"])
      material2 = normalize_material(@inputs["material2"] || material1)

      alpha1 = resolve_alpha("alpha_micro", material1, aliases: %w[alpha alphaMicro])
      alpha2 = resolve_alpha("alpha2_micro", material2, aliases: %w[alpha2 alpha2Micro])

      length = positive_number("length_mm", aliases: %w[length length1])
      delta_t = number("delta_t", aliases: %w[deltaT delta_t_c])

      alpha_temp_coeff = MATERIALS[material1][:alpha_temp_coeff]
      use_alpha_t =
        if @inputs.key?("use_alpha_temperature") || @inputs.key?("useAlphaTemperature")
          truthy?(@inputs["use_alpha_temperature"] || @inputs["useAlphaTemperature"])
        else
          calc_mode == "professional"
        end

      opts = { alpha_temp_coeff:, use_alpha_temperature: use_alpha_t }

      linear = linear_expansion(length, alpha1, delta_t, **opts)
      linear_constant = linear_expansion(length, alpha1, delta_t, use_alpha_temperature: false)

      result = {
        "calc_mode" => calc_mode,
        "material" => material1,
        "material2" => material2,
        "length_mm" => length,
        "delta_t" => delta_t,
        "reference_temp" => REFERENCE_TEMP,
        "operating_temp" => REFERENCE_TEMP + delta_t,
        "alpha1" => alpha1,
        "alpha2" => alpha2,
        "alpha1_micro" => round(alpha1 * 1e6, 3),
        "alpha2_micro" => round(alpha2 * 1e6, 3),
        "linear_expansion" => round(linear, 5),
        "linear_expansion_constant_alpha" => round(linear_constant, 5),
        "alpha_temperature_used" => use_alpha_t,
        "alpha_at_operating" => alpha_at_temperature(alpha1, REFERENCE_TEMP + delta_t, alpha_temp_coeff, use_alpha_t),
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      shaft_d = optional_number("shaft_diameter_mm", aliases: %w[shaftDiameter shaft_diameter])
      hole_d = optional_number("hole_diameter_mm", aliases: %w[holeDiameter hole_diameter])
      initial_interference = optional_number("initial_interference_mm", aliases: %w[initialInterference])

      fit = nil
      if shaft_d && hole_d
        fit = fit_change(shaft_d, hole_d, alpha1, alpha2, delta_t, initial_interference, opts)
      end

      result["fit"] = fit
      result["estimate_only"] = false

      if calc_mode == "professional" && shaft_d && hole_d
        assembly_delta_t = optional_number("assembly_delta_t", aliases: %w[assemblyDeltaT]) || 0.0
        service_delta_t = optional_number("service_delta_t", aliases: %w[serviceDeltaT]) || delta_t

        assembly_fit =
          fit_change(shaft_d, hole_d, alpha1, alpha2, assembly_delta_t, initial_interference || (shaft_d - hole_d), opts)
        service_fit =
          fit_change(
            shaft_d + assembly_fit["shaft_expansion"],
            hole_d + assembly_fit["hole_expansion"],
            alpha1,
            alpha2,
            service_delta_t - assembly_delta_t,
            assembly_fit["final_interference"],
            opts,
          )

        result["assembly_delta_t"] = assembly_delta_t
        result["service_delta_t"] = service_delta_t
        result["assembly_fit"] = assembly_fit
        result["service_fit"] = service_fit
        result["fit"] = service_fit
        fit = service_fit
      end

      result["pass"] = !(fit && fit["becomes_clearance"])

      if calc_mode == "professional" && fit
        result["interference_margin"] = fit["final_interference"]
        result["clearance_risk"] = fit["becomes_clearance"]
        result["recommended_max_delta_t"] =
          optional_number("max_delta_t", aliases: %w[maxDeltaT]) || round(delta_t.abs * 1.2, 2)
      end

      result
    end

    private

    def linear_expansion(length, alpha, delta_t, alpha_temp_coeff: 0.0, use_alpha_temperature: false)
      return 0.0 if length.to_f.zero? || delta_t.to_f.zero?
      return alpha * length * delta_t if !use_alpha_temperature || alpha_temp_coeff.to_f.zero?

      alpha_mean = alpha * (1.0 + alpha_temp_coeff * delta_t / 2.0)
      alpha_mean * length * delta_t
    end

    def fit_change(shaft_d, hole_d, shaft_alpha, hole_alpha, delta_t, initial_interference, opts)
      d_shaft = linear_expansion(shaft_d, shaft_alpha, delta_t, **opts)
      d_hole = linear_expansion(hole_d, hole_alpha, delta_t, **opts)
      change = d_shaft - d_hole
      initial = initial_interference.nil? ? (shaft_d - hole_d) : initial_interference
      final = initial + change

      {
        "shaft_expansion" => round(d_shaft, 5),
        "hole_expansion" => round(d_hole, 5),
        "interference_change" => round(change, 5),
        "initial_interference" => round(initial, 5),
        "final_interference" => round(final, 5),
        "becomes_clearance" => final < 0,
        "final_clearance" => final < 0 ? round(-final, 5) : 0.0,
      }
    end

    def alpha_at_temperature(alpha_ref, temp_c, alpha_temp_coeff, use_alpha_t)
      return round(alpha_ref * 1e6, 3) if !use_alpha_t || alpha_temp_coeff.to_f.zero?

      round(alpha_ref * (1.0 + alpha_temp_coeff * (temp_c - REFERENCE_TEMP)) * 1e6, 3)
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      case mode
      when "complete", "full" then "full"
      when "professional", "pro" then "professional"
      when "simple" then "simple"
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
      end
    end

    def normalize_material(raw)
      key = raw.to_s.presence || "steel"
      return key if MATERIALS.key?(key)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "material")
    end

    # Alpha override arrives in ×10⁻⁶ /°C (micro); fall back to material preset.
    def resolve_alpha(key, material, aliases: [])
      micro = resolve_number(key, aliases:)
      return MATERIALS[material][:alpha] if micro.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if micro <= 0

      micro * 1e-6
    end

    def number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?

      value
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0

      value
    end

    def optional_number(key, aliases: [])
      resolve_number(key, aliases:)
    end

    def resolve_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def truthy?(value)
      return value if value == true || value == false

      %w[1 true yes on].include?(value.to_s.downcase)
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
