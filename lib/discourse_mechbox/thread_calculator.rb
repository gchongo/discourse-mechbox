# frozen_string_literal: true

module DiscourseMechbox
  # Thread strength: simple / full / professional.
  # Ported from MechBox/src/utils/thread-calc.js
  class ThreadCalculator
    class Error < StandardError
    end

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

    THREAD_GRADES = {
      "4.6" => { allow_stress: 160.0 },
      "4.8" => { allow_stress: 200.0 },
      "5.6" => { allow_stress: 190.0 },
      "8.8" => { allow_stress: 400.0 },
      "10.9" => { allow_stress: 560.0 },
      "12.9" => { allow_stress: 630.0 },
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      grade = @inputs["grade"].to_s.presence || "8.8"
      grade_meta = THREAD_GRADES[grade]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "grade") if grade_meta.blank?

      d = positive_number("diameter_mm", aliases: %w[nominal_diameter_mm diameter])
      pitch = optional_number("pitch_mm", aliases: %w[pitch]) || METRIC_THREAD_PITCH[d.round] || 1.5
      raise Error, I18n.t("mechbox.errors.positive_values_required") if pitch <= 0

      force = number_or_zero("axial_force_n", aliases: %w[axial_force force])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "axial_force_n") if force < 0

      engaged =
        optional_number("engaged_length_mm", aliases: %w[engaged_length]) || (d * 1.5)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if engaged <= 0

      as = tensile_stress_area(d, pitch)
      d2 = pitch_diameter(d, pitch)
      d1 = minor_diameter(d, pitch)
      allow = grade_meta[:allow_stress]
      allow_shear = allow * 0.6

      sigma = tensile_stress(force, as)
      tau = shear_stress_simple(force, d1, engaged)
      friction = optional_number("friction_coeff") || 0.2
      torque = optional_number("torque_nm", aliases: %w[torque])
      torque_method = "simple_mu_d_f"
      tightening_torque = torque || ((friction * d * force) / 1000.0)

      result = {
        "calc_mode" => calc_mode,
        "grade" => grade,
        "diameter_mm" => d,
        "pitch_mm" => pitch,
        "stress_area_mm2" => as,
        "pitch_diameter_mm" => d2,
        "minor_diameter_mm" => d1,
        "axial_force_n" => force,
        "engaged_length_mm" => engaged,
        "allow_tensile_mpa" => allow,
        "allow_shear_mpa" => allow_shear,
        "max_allowable_force_n" => allow * as,
        "friction_coeff" => friction,
      }

      if %w[full professional].include?(calc_mode)
        area_ext = external_shear_area(d1, engaged)
        area_int = internal_shear_area(d2, engaged)
        tau_ext = area_ext.positive? ? force / area_ext : 0.0
        tau_int = area_int.positive? ? force / area_int : 0.0
        tau = [tau_ext, tau_int].max
        nut_material = @inputs["nut_material"].to_s.presence || "steel"
        m_eff_min = min_engagement(d, nut_material)

        result.merge!(
          "shear_external_mpa" => tau_ext,
          "shear_internal_mpa" => tau_int,
          "shear_area_external_mm2" => area_ext,
          "shear_area_internal_mm2" => area_int,
          "critical_shear_side" => tau_int >= tau_ext ? "internal" : "external",
          "min_engagement_mm" => m_eff_min,
          "engagement_pass" => engaged >= m_eff_min,
          "nut_material" => nut_material,
        )
      end

      if calc_mode == "professional"
        mu_g = optional_number("mu_g") || 0.12
        mu_k = optional_number("mu_k") || 0.12
        d_km = optional_number("d_km") || (1.45 * d)
        vdi_factor = 0.16 * pitch + 0.58 * d2 * mu_g + 0.5 * d_km * mu_k

        if force.positive?
          tightening_torque = (force * vdi_factor) / 1000.0
          torque_method = "vdi_2230"
        elsif torque
          force = (torque * 1000.0) / vdi_factor
          sigma = tensile_stress(force, as)
          result["axial_force_n"] = force
        end

        result.merge!(
          "mu_g" => mu_g,
          "mu_k" => mu_k,
          "d_km" => d_km,
          "vdi_torque_factor" => vdi_factor,
          "recommended_max_preload_n" => allow * as,
          "utilization" => allow.positive? ? sigma / allow : 0.0,
        )
      end

      tensile_pass = sigma <= allow
      shear_pass = tau <= allow_shear
      engagement_ok =
        if %w[full professional].include?(calc_mode)
          result["engagement_pass"] != false
        else
          true
        end

      overall =
        if calc_mode == "simple"
          false
        else
          tensile_pass && shear_pass && engagement_ok
        end

      result.merge!(
        "tensile_stress_mpa" => sigma,
        "shear_stress_mpa" => tau,
        "tightening_torque_nm" => tightening_torque,
        "torque_method" => torque_method,
        "tensile_pass" => tensile_pass,
        "shear_pass" => shear_pass,
        "pass" => overall,
        "estimate_only" => calc_mode == "simple",
      )

      result
    end

    private

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      case mode
      when "complete", "full"
        "full"
      when "professional", "pro"
        "professional"
      when "simple"
        "simple"
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
      end
    end

    def tensile_stress_area(diameter, pitch)
      d2 = diameter - 0.9382 * pitch
      (Math::PI / 4.0) * (d2**2)
    end

    def pitch_diameter(diameter, pitch)
      diameter - 0.6495 * pitch
    end

    def minor_diameter(diameter, pitch)
      diameter - 1.0825 * pitch
    end

    def tensile_stress(force, area)
      return 0.0 if area <= 0
      force / area
    end

    def shear_stress_simple(force, d1, engaged)
      area = 0.5 * Math::PI * d1 * engaged
      return 0.0 if area <= 0
      force / area
    end

    def external_shear_area(d1, engaged)
      0.5 * Math::PI * d1 * engaged
    end

    def internal_shear_area(d2, engaged)
      0.5 * Math::PI * d2 * engaged
    end

    def min_engagement(diameter, nut_material)
      factor = nut_material == "soft" ? 1.0 : 0.8
      factor * diameter
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
