# frozen_string_literal: true

module DiscourseMechbox
  # Open belt / V-belt drive (simplified).
  # Ported from MechBox/src/utils/belt-calc.js.
  class BeltCalculator
    class Error < StandardError
    end

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])

      d1 = positive_number("driver_diameter_mm", aliases: %w[driver_diameter driverDiameter])
      d2 = positive_number("driven_diameter_mm", aliases: %w[driven_diameter drivenDiameter])
      center = positive_number("center_distance_mm", aliases: %w[center_distance centerDistance])
      rpm = number_or_zero("rpm")
      raise Error, I18n.t("mechbox.errors.positive_values_required") if d2 < d1

      ratio = drive_ratio(d2, d1)
      length = belt_length(d1, d2, center)
      speed = belt_speed(d1, rpm)

      wrap_angle =
        if calc_mode == "simple"
          optional_number("wrap_angle_deg", aliases: %w[wrap_angle wrapAngle]) || 180.0
        else
          wrap_angle_geom(d1, d2, center)
        end

      service_factor =
        if calc_mode == "professional"
          optional_number("service_factor", aliases: %w[serviceFactor]) || 1.2
        else
          1.0
        end

      power_kw =
        optional_number("power_kw", aliases: %w[power]) ||
          power_from_torque(
            optional_number("torque_nm", aliases: %w[torque]),
            rpm,
          )
      raise Error, I18n.t("mechbox.errors.positive_values_required") if power_kw <= 0

      design_power_kw = power_kw * service_factor
      efficiency = optional_number("efficiency") || 0.95
      friction = optional_number("friction_coeff", aliases: %w[friction]) || 0.3

      tension = belt_tension(
        power_kw: design_power_kw,
        speed_mps: speed,
        efficiency:,
        wrap_angle_deg: wrap_angle,
        friction:,
      )

      driven_rpm = ratio.positive? ? rpm / ratio : 0.0

      result = {
        "calc_mode" => calc_mode,
        "driver_diameter_mm" => d1,
        "driven_diameter_mm" => d2,
        "center_distance_mm" => center,
        "rpm" => rpm,
        "power_kw" => power_kw,
        "design_power_kw" => design_power_kw,
        "ratio" => ratio,
        "belt_length_mm" => length,
        "belt_speed_mps" => speed,
        "wrap_angle_deg" => wrap_angle,
        "driven_rpm" => driven_rpm,
        "tight_side_force_n" => tension[:f1],
        "slack_side_force_n" => tension[:f2],
        "effective_force_n" => tension[:effective_force],
        "efficiency" => efficiency,
        "friction_coeff" => friction,
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      power_per_belt_kw =
        optional_number("power_per_belt_kw", aliases: %w[power_per_belt powerPerBelt]) ||
          power_kw
      max_speed = optional_number("max_belt_speed_mps", aliases: %w[max_belt_speed maxBeltSpeed]) || 30.0
      belt_count = belt_count(power_kw, power_per_belt_kw, 1.0)
      speed_pass = speed <= max_speed

      result.merge!(
        "power_per_belt_kw" => power_per_belt_kw,
        "belt_count" => belt_count,
        "max_belt_speed_mps" => max_speed,
        "speed_pass" => speed_pass,
        "pass" => speed_pass,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        belt_count = belt_count(power_kw, power_per_belt_kw, service_factor)
        belt_section = optional_number("belt_section_mm2", aliases: %w[belt_section beltSection]) || 80.0
        allow_tension = optional_number("allow_tension_n", aliases: %w[allow_tension allowTension]) || 600.0
        flex_stress = tension[:f1] / belt_section
        flex_pass = flex_stress <= allow_tension
        life_base = 10_000.0
        life_factor = allow_tension / [tension[:f1], 1.0].max
        estimated_life_hours = life_base * (life_factor**3)

        result.merge!(
          "service_factor" => service_factor,
          "belt_count" => belt_count,
          "belt_section_mm2" => belt_section,
          "allow_tension_n" => allow_tension,
          "flex_stress_n_per_mm2" => flex_stress,
          "flex_pass" => flex_pass,
          "estimated_life_hours" => estimated_life_hours,
          "pass" => speed_pass && flex_pass,
        )
      end

      result
    end

    private

    def belt_length(d1, d2, center)
      return 0.0 if center <= 0

      (2.0 * center) + (Math::PI * (d1 + d2) / 2.0) + (((d2 - d1)**2) / (4.0 * center))
    end

    def drive_ratio(d2, d1)
      return 0.0 if d1 <= 0

      d2 / d1
    end

    def belt_speed(diameter, rpm)
      (Math::PI * diameter * rpm) / 60_000.0
    end

    def wrap_angle_geom(d1, d2, center)
      return 180.0 if center <= 0 || d2 <= d1

      sin_arg = (d2 - d1) / (2.0 * center)
      return 120.0 if sin_arg >= 1.0

      angle = 180.0 - (2.0 * Math.asin(sin_arg) * 180.0) / Math::PI
      [[angle, 120.0].max, 210.0].min
    end

    def belt_tension(power_kw:, speed_mps:, efficiency:, wrap_angle_deg:, friction:)
      return { f1: 0.0, f2: 0.0, effective_force: 0.0 } if speed_mps <= 0

      effective_force = (power_kw * 1000.0) / (speed_mps * efficiency)
      theta = (wrap_angle_deg * Math::PI) / 180.0
      ratio = Math.exp(friction * theta)
      return { f1: effective_force, f2: 0.0, effective_force: } if ratio <= 1.0

      f2 = effective_force / (ratio - 1.0)
      f1 = f2 * ratio
      { f1:, f2:, effective_force: }
    end

    def belt_count(power_kw, power_per_belt_kw, service_factor)
      return 1 if power_per_belt_kw <= 0

      [(power_kw * service_factor / power_per_belt_kw).ceil, 1].max
    end

    def power_from_torque(torque_nm, rpm)
      return 0.0 if torque_nm.nil? || torque_nm <= 0 || rpm <= 0

      (torque_nm * 2.0 * Math::PI * rpm) / 60_000.0
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

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0
      value
    end

    def optional_number(key, aliases: [])
      resolve_number(key, aliases:)
    end

    def number_or_zero(key, aliases: [])
      resolve_number(key, aliases:) || 0.0
    end

    def resolve_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end
  end
end
