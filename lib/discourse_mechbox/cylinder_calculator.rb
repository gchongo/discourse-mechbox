# frozen_string_literal: true

module DiscourseMechbox
  # Hydraulic/pneumatic cylinder estimate ported from MechBox/src/utils/hydraulic-calc.js.
  # Units: pressure MPa, area mm^2, force N; flow L/min, velocity mm/s, length mm.
  class CylinderCalculator
    class Error < StandardError
    end

    END_FIXITY = {
      "fixed_fixed" => 0.5,
      "fixed_pinned" => 1.0 / Math.sqrt(2.0),
      "pinned_pinned" => 1.0,
      "fixed_free" => 2.0,
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      cylinder_type = normalize_type(@inputs["cylinder_type"] || @inputs["type"])
      efficiency = cylinder_type == "pneumatic" ? optional_efficiency("efficiency") || 0.85 : 1.0

      bore_diameter = positive_number("bore_diameter_mm", aliases: %w[boreDiameter bore_diameter])
      rod_diameter = optional_non_negative_number("rod_diameter_mm", aliases: %w[rodDiameter rod_diameter]) || 0.0
      pressure = non_negative_number("pressure_mpa", aliases: %w[pressure])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rod_diameter_mm") if rod_diameter >= bore_diameter

      areas = cylinder_areas(bore_diameter, rod_diameter)
      hydraulic_extend_force = pressure * areas[:bore]
      hydraulic_retract_force = pressure * areas[:annular]
      extend_force = hydraulic_extend_force * efficiency
      retract_force = hydraulic_retract_force * efficiency

      flow_rate = optional_non_negative_number("flow_rate_lpm", aliases: %w[flowRate flow_rate])
      fallback_velocity = optional_non_negative_number("velocity_mm_s", aliases: %w[velocity]) || 0.0
      extend_velocity = flow_rate ? flow_rate * 1_000_000.0 / (60.0 * areas[:bore]) : fallback_velocity
      retract_velocity = flow_rate ? flow_rate * 1_000_000.0 / (60.0 * areas[:annular]) : fallback_velocity

      result = {
        "calc_mode" => calc_mode,
        "type" => cylinder_type,
        "bore_area_mm2" => round(areas[:bore], 6),
        "annular_area_mm2" => round(areas[:annular], 6),
        "rod_area_mm2" => round(areas[:rod], 6),
        "pressure_mpa" => pressure,
        "extend_force_n" => round(extend_force, 6),
        "retract_force_n" => round(retract_force, 6),
        "extend_velocity_mm_s" => round(extend_velocity, 6),
        "retract_velocity_mm_s" => round(retract_velocity, 6),
        "extend_flow_lpm" => round(flow_rate_from_area_velocity(areas[:bore], extend_velocity), 6),
        "retract_flow_lpm" => round(flow_rate_from_area_velocity(areas[:annular], retract_velocity), 6),
      }
      result["efficiency"] = efficiency if cylinder_type == "pneumatic"

      if calc_mode == "simple"
        result["estimate_only"] = true
        result["pass"] = false
        return result
      end

      external_load = optional_non_negative_number("external_load_n", aliases: %w[externalLoad external_load]) || 0.0
      result["external_load_n"] = external_load
      result["extend_margin_n"] = round(extend_force - external_load, 6)
      result["retract_margin_n"] = round(retract_force - external_load, 6)
      result["load_pass"] = extend_force >= external_load && retract_force >= external_load

      if rod_diameter.positive? && (stroke = optional_positive_number("stroke_length_mm", aliases: %w[strokeLength stroke_length]))
        buckling = rod_buckling_load(rod_diameter, stroke)
        compressive_load = optional_non_negative_number("rod_compressive_load_n", aliases: %w[rodCompressiveLoad])
        compressive_load ||= truthy_false?(@inputs["compress_on_retract"] || @inputs["compressOnRetract"]) ? 0.0 : external_load
        result["rod_compressive_load_n"] = compressive_load
        result["buckling_load_n"] = round(buckling["critical_load_n"], 6)
        result["buckling"] = buckling.merge(
          "compressive_load_n" => compressive_load,
          "buckling_pass" => compressive_load <= 0.0 ? nil : compressive_load <= buckling["critical_load_n"],
          "check_skipped" => compressive_load <= 0.0,
        )
        result["buckling_pass"] = result["buckling"]["buckling_pass"].nil? ? true : result["buckling"]["buckling_pass"]
      else
        result["buckling_pass"] = true
      end

      if external_load.positive?
        result["required_pressure_extend_mpa"] = round(external_load / (areas[:bore] * efficiency), 6)
        result["required_pressure_retract_mpa"] = round(external_load / (areas[:annular] * efficiency), 6)
      end

      result["pass"] = result["load_pass"] && result["buckling_pass"]

      if calc_mode == "professional"
        mass = optional_non_negative_number("load_mass_kg", aliases: %w[loadMass load_mass]) || 0.0
        acceleration = optional_number("acceleration_m_s2", aliases: %w[acceleration]) || 0.0
        dynamic_load = mass * 9.81 + mass * acceleration
        stroke = optional_positive_number("stroke_length_mm", aliases: %w[strokeLength stroke_length])
        cushion_pressure = optional_non_negative_number("cushion_pressure_mpa", aliases: %w[cushionPressure]) || pressure * 0.3
        result.merge!(
          "dynamic_load_n" => round(dynamic_load, 6),
          "cycle_time_extend_s" => stroke && extend_velocity.positive? ? round(stroke / extend_velocity, 6) : nil,
          "cycle_time_retract_s" => stroke && retract_velocity.positive? ? round(stroke / retract_velocity, 6) : nil,
          "cushion_pressure_mpa" => cushion_pressure,
          "cushion_force_n" => round(cushion_pressure * areas[:bore] * efficiency, 6),
        )
        result["dynamic_load_pass"] = extend_force >= dynamic_load
        result["pass"] = result["pass"] && result["dynamic_load_pass"]
      end

      result
    end

    private

    def cylinder_areas(bore_diameter, rod_diameter)
      bore = Math::PI * bore_diameter**2 / 4.0
      rod = rod_diameter.positive? ? Math::PI * rod_diameter**2 / 4.0 : 0.0
      { bore:, annular: bore - rod, rod: }
    end

    def flow_rate_from_area_velocity(area, velocity)
      area * velocity * 60.0 / 1_000_000.0
    end

    def rod_buckling_load(rod_diameter, length)
      yield_strength = optional_positive_number("yield_strength_mpa", aliases: %w[yieldStrength]) || 235.0
      end_fixity_raw = @inputs["end_fixity"] || @inputs["endFixity"] || "pinned_pinned"
      factor = resolve_end_fixity(end_fixity_raw)
      area = Math::PI * rod_diameter**2 / 4.0
      inertia = Math::PI * rod_diameter**4 / 64.0
      radius_gyration = Math.sqrt(inertia / area)
      elastic_modulus = 210_000.0
      effective_length = factor * length
      euler_load = Math::PI**2 * elastic_modulus * inertia / effective_length**2
      yield_load = area * yield_strength
      slenderness = effective_length / radius_gyration

      if euler_load <= yield_load
        critical_load = euler_load
        mode = "euler"
      else
        sigma_johnson = yield_strength - (yield_strength**2 / (4.0 * Math::PI**2 * elastic_modulus)) * slenderness**2
        johnson_load = area * [sigma_johnson, 0.0].max
        critical_load = [yield_load, johnson_load].min
        mode = johnson_load <= yield_load ? "johnson" : "yield"
      end

      {
        "critical_load_n" => critical_load,
        "effective_length_factor" => factor,
        "effective_length_mm" => round(effective_length, 6),
        "slenderness" => round(slenderness, 6),
        "governing_mode" => mode,
        "euler_load_n" => round(euler_load, 6),
        "yield_load_n" => round(yield_load, 6),
      }
    end

    def resolve_end_fixity(raw)
      return END_FIXITY[raw] if raw.is_a?(String) && END_FIXITY.key?(raw)

      factor = Float(raw)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "end_fixity") if factor <= 0.0

      factor
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "end_fixity")
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def normalize_type(raw)
      type = raw.to_s.presence || "hydraulic"
      return type if %w[hydraulic pneumatic].include?(type)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "cylinder_type")
    end

    def truthy_false?(raw)
      raw == false || raw.to_s == "false" || raw.to_s == "0"
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def non_negative_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

      value
    end

    def optional_positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def optional_efficiency(key, aliases: [])
      value = optional_positive_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value > 1.0

      value
    end

    def optional_non_negative_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

      value
    end

    def optional_number(key, aliases: [])
      resolve_number(key, aliases:)
    end

    def resolve_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      value = Float(raw)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) unless value.finite?

      value
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end