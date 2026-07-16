# frozen_string_literal: true

module DiscourseMechbox
  # Roller chain drive (GB/T 1243 simplified).
  # Ported from MechBox/src/utils/chain-calc.js.
  class ChainCalculator
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

      pitch = positive_number("pitch_mm", aliases: %w[pitch])
      z1 = positive_number("driver_teeth", aliases: %w[driverTeeth])
      z2 = positive_number("driven_teeth", aliases: %w[drivenTeeth])
      center = positive_number("center_distance_mm", aliases: %w[center_distance centerDistance])
      rpm = number_or_zero("rpm")

      raise Error, I18n.t("mechbox.errors.positive_values_required") if z2 < z1

      ratio = chain_ratio(z2, z1)
      length = chain_length(pitch, z1, z2, center)
      speed = chain_speed(pitch, z1, rpm)
      links = pitch.positive? ? (length / pitch).ceil : 0

      service_factor =
        case calc_mode
        when "professional"
          optional_number("service_factor", aliases: %w[serviceFactor]) || 1.3
        when "full"
          optional_number("service_factor", aliases: %w[serviceFactor]) || 1.15
        else
          1.0
        end

      power_kw =
        optional_number("power_kw", aliases: %w[power]) ||
          power_from_torque(optional_number("torque_nm", aliases: %w[torque]), rpm)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if power_kw <= 0

      design_power_kw = power_kw * service_factor
      efficiency = optional_number("efficiency") || 0.98
      tension = chain_tension(design_power_kw, speed, efficiency)
      driven_rpm = ratio.positive? ? rpm / ratio : 0.0

      result = {
        "calc_mode" => calc_mode,
        "pitch_mm" => pitch,
        "driver_teeth" => z1,
        "driven_teeth" => z2,
        "center_distance_mm" => center,
        "rpm" => rpm,
        "power_kw" => power_kw,
        "design_power_kw" => design_power_kw,
        "ratio" => ratio,
        "chain_length_mm" => length,
        "links" => links,
        "chain_speed_mps" => speed,
        "chain_tension_n" => tension,
        "driven_rpm" => driven_rpm,
        "service_factor" => service_factor,
        "efficiency" => efficiency,
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      max_speed =
        optional_number("max_chain_speed_mps", aliases: %w[max_chain_speed maxChainSpeed]) || 15.0
      allow_tension =
        optional_number("allow_tension_n", aliases: %w[allow_tension allowTension]) || 20_000.0
      speed_pass = speed <= max_speed
      tension_pass = tension <= allow_tension
      utilization = allow_tension.positive? ? tension / allow_tension : nil

      result.merge!(
        "max_chain_speed_mps" => max_speed,
        "allow_tension_n" => allow_tension,
        "speed_pass" => speed_pass,
        "tension_pass" => tension_pass,
        "tension_utilization" => utilization,
        "pass" => speed_pass && tension_pass,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        lubrication =
          optional_number("lubrication_factor", aliases: %w[lubricationFactor]) || 1.0
        strands = optional_number("strands") || 1.0
        strands = [strands.ceil, 1].max
        tension_per_strand = tension / strands
        life_base = 15_000.0
        life_factor = allow_tension / [tension, 1.0].max
        estimated_life_hours = life_base * (life_factor**2) * lubrication
        strand_pass = tension_per_strand <= allow_tension

        result.merge!(
          "lubrication_factor" => lubrication,
          "strands" => strands,
          "tension_per_strand_n" => tension_per_strand,
          "estimated_life_hours" => estimated_life_hours,
          "pass" => speed_pass && tension_pass && strand_pass,
        )
      end

      result
    end

    private

    def chain_ratio(z2, z1)
      return 0.0 if z1 <= 0

      z2 / z1
    end

    def chain_length(pitch, z1, z2, center)
      return 0.0 if pitch <= 0 || center <= 0

      lp =
        (2.0 * center) / pitch + (z1 + z2) / 2.0 +
          (pitch * ((z2 - z1)**2)) / (4.0 * (Math::PI**2) * center)
      lp.ceil * pitch
    end

    def chain_speed(pitch, teeth, rpm)
      (pitch * teeth * rpm) / 60_000.0
    end

    def chain_tension(power_kw, speed_mps, efficiency)
      return 0.0 if speed_mps <= 0 || efficiency <= 0

      (power_kw * 1000.0) / speed_mps / efficiency
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
