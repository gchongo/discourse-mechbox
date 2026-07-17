# frozen_string_literal: true

module DiscourseMechbox
  # Interference fit (press-fit): Lame contact pressure, press force, torque.
  # Ported from MechBox/src/utils/interference-fit-calc.js (+ thermal fit change).
  class InterferenceFitCalculator
    class Error < StandardError
    end

    DEFAULT_E = 210_000.0
    DEFAULT_NU = 0.3
    DEFAULT_FRICTION = 0.12
    DEFAULT_ALLOW_HOOP = 350.0
    DEFAULT_ALPHA = 11.5e-6

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])

      shaft_d = positive_number("shaft_diameter_mm", aliases: %w[shaftDiameter shaft_diameter])
      hole_d =
        optional_number("hole_diameter_mm", aliases: %w[holeDiameter hole_diameter]) ||
          (shaft_d - (optional_number("interference_mm", aliases: %w[interference]) || 0.0))

      interference =
        optional_number("interference_mm", aliases: %w[interference]) || (shaft_d - hole_d)
      nominal_interference = interference

      raise Error, I18n.t("mechbox.errors.positive_values_required") if interference <= 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "hole_diameter_mm") if hole_d <= 0

      hub_outer = positive_number("hub_outer_diameter_mm", aliases: %w[hubOuterDiameter hub_outer])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "hub_outer_diameter_mm") if hub_outer <= hole_d

      fit_length =
        optional_number("fit_length_mm", aliases: %w[fitLength fit_length]) || 40.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if fit_length <= 0

      friction =
        optional_number("friction", aliases: %w[mu]) || DEFAULT_FRICTION
      raise Error, I18n.t("mechbox.errors.positive_values_required") if friction <= 0

      shaft_e = optional_number("shaft_e_mpa", aliases: %w[shaftE shaft_e]) || DEFAULT_E
      hub_e = optional_number("hub_e_mpa", aliases: %w[hubE hub_e]) || DEFAULT_E
      shaft_nu = optional_number("shaft_nu", aliases: %w[shaftNu]) || DEFAULT_NU
      hub_nu = optional_number("hub_nu", aliases: %w[hubNu]) || DEFAULT_NU

      shaft_inner =
        if calc_mode == "simple"
          0.0
        else
          optional_number("shaft_inner_diameter_mm", aliases: %w[shaftInnerDiameter shaft_inner]) || 0.0
        end
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "shaft_inner_diameter_mm") if shaft_inner < 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "shaft_inner_diameter_mm") if shaft_inner >= shaft_d

      thermal = nil
      if calc_mode == "professional"
        delta_t = optional_number("delta_t", aliases: %w[deltaT]) || 0.0
        if !delta_t.zero?
          shaft_alpha = resolve_alpha("shaft_alpha_micro", aliases: %w[shaftAlpha shaft_alpha])
          hole_alpha = resolve_alpha("hole_alpha_micro", aliases: %w[holeAlpha hole_alpha])
          thermal = fit_change(shaft_d, hole_d, shaft_alpha, hole_alpha, delta_t, interference)
          interference = thermal["final_interference"]
          if thermal["becomes_clearance"]
            return {
              "calc_mode" => calc_mode,
              "error_key" => "clearance_after_thermal",
              "thermal" => thermal,
              "nominal_interference" => round(nominal_interference, 5),
              "interference" => round(interference, 5),
              "pass" => false,
              "estimate_only" => false,
            }
          end
        end
      end

      contact =
        contact_pressure(
          interference:,
          hole_d:,
          hub_outer:,
          shaft_d:,
          shaft_inner:,
          shaft_e:,
          hub_e:,
          shaft_nu:,
          hub_nu:,
        )

      press_force = contact[:pressure] * Math::PI * shaft_d * fit_length * (friction + 0.02)
      torque_capacity = (contact[:pressure] * Math::PI * shaft_d * shaft_d * fit_length * friction) / 2.0
      min_hub_wall = (hub_outer - hole_d) / 2.0
      thin_wall_warning = min_hub_wall < shaft_d * 0.1

      shaft_allow =
        optional_number("shaft_allow_hoop_mpa", aliases: %w[shaftAllowHoop]) || DEFAULT_ALLOW_HOOP
      hub_allow =
        optional_number("hub_allow_hoop_mpa", aliases: %w[hubAllowHoop]) || DEFAULT_ALLOW_HOOP
      allow_pressure = optional_number("allow_pressure_mpa", aliases: %w[allowPressure])

      hoop_pass = contact[:hoop_shaft] <= shaft_allow && contact[:hoop_hub] <= hub_allow
      pressure_ok =
        contact[:pressure] > 0 && (allow_pressure.nil? || contact[:pressure] < allow_pressure)

      result = {
        "calc_mode" => calc_mode,
        "shaft_diameter_mm" => shaft_d,
        "hole_diameter_mm" => hole_d,
        "hub_outer_diameter_mm" => hub_outer,
        "shaft_inner_diameter_mm" => shaft_inner,
        "fit_length_mm" => fit_length,
        "friction" => friction,
        "nominal_interference" => round(nominal_interference, 5),
        "interference" => round(interference, 5),
        "radial_interference" => round(contact[:radial_interference], 5),
        "pressure" => round(contact[:pressure], 4),
        "hoop_hub" => round(contact[:hoop_hub], 4),
        "hoop_shaft" => round(contact[:hoop_shaft], 4),
        "hollow_shaft" => contact[:hollow_shaft],
        "lambda_h" => round(contact[:lambda_h], 8),
        "lambda_s" => round(contact[:lambda_s], 8),
        "press_force" => round(press_force, 2),
        "torque_capacity" => round(torque_capacity, 2),
        "torque_capacity_nm" => round(torque_capacity / 1000.0, 3),
        "min_hub_wall" => round(min_hub_wall, 4),
        "thin_wall_warning" => thin_wall_warning,
        "shaft_allow_hoop" => shaft_allow,
        "hub_allow_hoop" => hub_allow,
        "hoop_pass" => hoop_pass,
        "thermal" => thermal,
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      result.merge!(
        "pass" => pressure_ok && hoop_pass,
        "estimate_only" => false,
      )
    end

    private

    def contact_pressure(
      interference:,
      hole_d:,
      hub_outer:,
      shaft_d:,
      shaft_inner:,
      shaft_e:,
      hub_e:,
      shaft_nu:,
      hub_nu:
    )
      ri = hole_d / 2.0
      ro = hub_outer / 2.0
      delta_r = interference / 2.0
      lambda_h = hub_compliance(ri, ro, hub_e, hub_nu)

      shaft_ro = shaft_d / 2.0
      shaft_ri = shaft_inner / 2.0
      hollow = shaft_inner > 0
      lambda_s =
        if hollow
          shaft_compliance_hollow(shaft_ri, shaft_ro, shaft_e, shaft_nu)
        else
          shaft_compliance_solid(shaft_e, shaft_nu)
        end

      denom = ri * (lambda_h + lambda_s)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "geometry") if denom <= 0

      pressure = delta_r / denom
      hoop_hub = pressure * ((ro * ro + ri * ri) / (ro * ro - ri * ri))
      hoop_shaft =
        if hollow
          pressure * (2.0 * shaft_ro**2 / (shaft_ro**2 - shaft_ri**2))
        else
          pressure
        end

      {
        pressure:,
        hoop_hub:,
        hoop_shaft:,
        radial_interference: delta_r,
        lambda_h:,
        lambda_s:,
        hollow_shaft: hollow,
      }
    end

    def hub_compliance(ri, ro, elastic_mod, nu)
      return 0.0 if ro <= ri

      (1.0 / elastic_mod) * ((ro * ro + ri * ri) / (ro * ro - ri * ri) + nu)
    end

    def shaft_compliance_solid(elastic_mod, nu)
      (1.0 - nu) / elastic_mod
    end

    def shaft_compliance_hollow(ri, ro, elastic_mod, nu)
      return shaft_compliance_solid(elastic_mod, nu) if ro <= ri || ri <= 0

      (1.0 / elastic_mod) * ((ro * ro + ri * ri) / (ro * ro - ri * ri) + nu)
    end

    def fit_change(shaft_d, hole_d, shaft_alpha, hole_alpha, delta_t, initial_interference)
      d_shaft = shaft_alpha * shaft_d * delta_t
      d_hole = hole_alpha * hole_d * delta_t
      change = d_shaft - d_hole
      final = initial_interference + change

      {
        "shaft_expansion" => round(d_shaft, 5),
        "hole_expansion" => round(d_hole, 5),
        "interference_change" => round(change, 5),
        "initial_interference" => round(initial_interference, 5),
        "final_interference" => round(final, 5),
        "becomes_clearance" => final < 0,
        "final_clearance" => final < 0 ? round(-final, 5) : 0.0,
      }
    end

    def resolve_alpha(key, aliases: [])
      micro = resolve_number(key, aliases:)
      return DEFAULT_ALPHA if micro.nil?

      # Accept either micro (11.5) or absolute (11.5e-6).
      value = micro > 1e-3 ? micro * 1e-6 : micro
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0

      value
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

    def resolve_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
