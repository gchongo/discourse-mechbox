# frozen_string_literal: true

module DiscourseMechbox
  # Friction clutch torque (simplified).
  # Ported from MechBox/src/utils/clutch-calc.js.
  class ClutchCalculator
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
      friction = number_or_default("friction_coeff", aliases: %w[frictionCoeff], default: 0.15)
      surfaces = number_or_default("surfaces", default: 1.0)
      rpm = number_or_zero("rpm")
      raise Error, I18n.t("mechbox.errors.positive_values_required") if friction <= 0 || surfaces <= 0

      radius = optional_number("radius_mm", aliases: %w[radius]) || 80.0
      inner_d = optional_number("inner_diameter_mm", aliases: %w[inner_diameter innerDiameter])
      outer_d = optional_number("outer_diameter_mm", aliases: %w[outer_diameter outerDiameter])

      if calc_mode != "simple" && inner_d && outer_d
        raise Error, I18n.t("mechbox.errors.positive_values_required") if inner_d <= 0 || outer_d <= 0
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "outer_diameter_mm") if outer_d <= inner_d

        radius = mean_friction_radius(inner_d, outer_d)
      end

      raise Error, I18n.t("mechbox.errors.positive_values_required") if radius <= 0

      force = number_or_zero("force_n", aliases: %w[force clamp_force_n clampForce])
      required_torque = number_or_zero("required_torque_nm", aliases: %w[required_torque requiredTorque])

      if force <= 0 && required_torque.positive?
        force = required_force(required_torque, friction, radius, surfaces)
      end

      torque =
        if @inputs["torque_nm"] || @inputs["torque"]
          number_or_zero("torque_nm", aliases: %w[torque])
        else
          clutch_torque(friction, force, radius, surfaces)
        end

      allow = optional_number("allowable_torque_nm", aliases: %w[allowable_torque allowableTorque]) || Float::INFINITY
      power = (torque * 2.0 * Math::PI * rpm) / 60_000.0
      torque_pass = torque <= allow

      result = {
        "calc_mode" => calc_mode,
        "friction_coeff" => friction,
        "surfaces" => surfaces,
        "rpm" => rpm,
        "clamp_force_n" => force,
        "effective_radius_mm" => radius,
        "torque_nm" => torque,
        "power_kw" => power,
        "allowable_torque_nm" => allow.finite? ? allow : nil,
        "torque_pass" => torque_pass,
        "pass" => torque_pass,
      }

      if calc_mode == "simple"
        result.merge!(
          "estimate_only" => true,
          "pass" => false,
        )
        return result
      end

      area =
        if inner_d && outer_d
          (Math::PI * ((outer_d**2) - (inner_d**2))) / 4.0
        else
          Math::PI * ((2.0 * radius)**2) / 4.0
        end

      max_pressure = optional_number("max_pressure_mpa", aliases: %w[max_pressure maxPressure]) || 1.5
      contact_pressure = area.positive? ? force / area : 0.0
      pressure_pass = contact_pressure <= 0 || contact_pressure <= max_pressure
      utilization = allow.finite? && allow.positive? ? torque / allow : nil

      result.merge!(
        "inner_diameter_mm" => inner_d,
        "outer_diameter_mm" => outer_d,
        "contact_area_mm2" => area,
        "contact_pressure_mpa" => contact_pressure,
        "max_pressure_mpa" => max_pressure,
        "pressure_pass" => pressure_pass,
        "utilization" => utilization,
        "pass" => torque_pass && pressure_pass,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        plate_mass = optional_number("plate_mass_kg", aliases: %w[plate_mass plateMass]) || 0.5
        thermal_fade = optional_number("thermal_fade", aliases: %w[thermalFade]) || 1.0
        safety_factor = optional_number("safety_factor", aliases: %w[safetyFactor]) || 1.2
        outer_for_centrifugal = outer_d || (radius * 2.0)

        centrifugal = centrifugal_reduction(rpm, outer_for_centrifugal, plate_mass)
        effective_force = [0.0, force - centrifugal].max
        torque_at_speed = clutch_torque(friction, effective_force, radius, surfaces)
        derated_torque = torque_at_speed * thermal_fade

        pro_pass =
          if required_torque.positive?
            derated_torque >= (required_torque * safety_factor) && pressure_pass
          else
            result["pass"]
          end

        result.merge!(
          "required_torque_nm" => required_torque.positive? ? required_torque : nil,
          "plate_mass_kg" => plate_mass,
          "thermal_fade" => thermal_fade,
          "safety_factor" => safety_factor,
          "centrifugal_force_n" => centrifugal,
          "effective_force_n" => effective_force,
          "torque_at_speed_nm" => torque_at_speed,
          "derated_torque_nm" => derated_torque,
          "pass" => pro_pass,
        )
      end

      result
    end

    private

    def clutch_torque(friction, force, radius, surfaces)
      (friction * force * radius * surfaces) / 1000.0
    end

    def required_force(torque, friction, radius, surfaces)
      return 0.0 if friction <= 0 || radius <= 0 || surfaces <= 0

      (torque * 1000.0) / (friction * radius * surfaces)
    end

    def mean_friction_radius(inner_diameter, outer_diameter)
      ri = inner_diameter / 2.0
      ro = outer_diameter / 2.0
      return ro if ro <= ri

      (2.0 * ((ro**3) - (ri**3))) / (3.0 * ((ro**2) - (ri**2)))
    end

    def centrifugal_reduction(rpm, outer_diameter, mass_per_plate)
      omega = (rpm * 2.0 * Math::PI) / 60.0
      r = outer_diameter / 2000.0
      mass_per_plate * (omega**2) * r
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

    def number_or_default(key, aliases: [], default:)
      value = resolve_number(key, aliases:)
      value.nil? ? default : value
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
