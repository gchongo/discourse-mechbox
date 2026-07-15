# frozen_string_literal: true

module DiscourseMechbox
  # Helical compression spring (GB/T 23935 simplified).
  # Ported from MechBox/src/utils/spring-calc.js (core subset).
  class SpringCalculator
    class Error < StandardError
    end

    MATERIALS = {
      "50CrVA" => { allowable_shear: 529.0, g: 80_000.0, rm: 1810.0, test_factor: 0.55 },
      "60Si2CrA" => { allowable_shear: 684.0, g: 80_000.0, rm: 1960.0, test_factor: 0.55 },
      "65Mn" => { allowable_shear: 540.0, g: 80_000.0, rm: 1570.0, test_factor: 0.55 },
      "music_wire" => { allowable_shear: 900.0, g: 80_000.0, rm: 2000.0, test_factor: 0.55 },
      "oil_tempered" => { allowable_shear: 700.0, g: 80_000.0, rm: 1750.0, test_factor: 0.55 },
      "stainless" => { allowable_shear: 550.0, g: 80_000.0, rm: 1600.0, test_factor: 0.45 },
      "custom" => { allowable_shear: 600.0, g: 80_000.0, rm: 1600.0, test_factor: 0.55 },
    }.freeze

    BUCKLING_LIMITS = { "fixed" => 5.3, "guided" => 3.7, "free" => 3.7, "rotating" => 2.6 }.freeze

    TAU_U0_RM_LEVELS = [
      { cycles: 10_000.0, factor: 0.45 },
      { cycles: 100_000.0, factor: 0.4 },
      { cycles: 1_000_000.0, factor: 0.35 },
      { cycles: 10_000_000.0, factor: 0.32 },
      { cycles: 100_000_000.0, factor: 0.3 },
    ].freeze

    DENSITY = 7.85e-6 # kg/mm³

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      material_key = (@inputs["material"] || "50CrVA").to_s
      mat = MATERIALS[material_key] || MATERIALS["custom"]
      material_key = MATERIALS.key?(material_key) ? material_key : "custom"

      d = positive_number("wire_diameter_mm", aliases: %w[wire_diameter wireDiameter])
      active = positive_number("active_coils", aliases: %w[activeCoils])
      end_type = normalize_end_type(@inputs["end_type"] || @inputs["endType"])

      mean_d =
        optional_number("mean_diameter_mm", aliases: %w[mean_diameter meanDiameter])
      outer_d =
        optional_number("outer_diameter_mm", aliases: %w[outer_diameter outerDiameter])
      if mean_d.nil? && outer_d
        mean_d = outer_d - d
      end
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "mean_diameter_mm") if mean_d.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if mean_d <= 0
      outer_d ||= mean_d + d

      g = optional_number("shear_modulus_mpa", aliases: %w[shear_modulus shearModulus]) || mat[:g]
      allow =
        optional_number("allowable_shear_mpa", aliases: %w[allowable_shear allowableShear]) ||
          mat[:allowable_shear]
      rm = optional_number("tensile_strength_mpa", aliases: %w[tensile_strength tensileStrength]) || mat[:rm]
      raise Error, I18n.t("mechbox.errors.positive_values_required") if g <= 0 || allow <= 0 || rm <= 0

      index = mean_d / d
      raise Error, I18n.t("mechbox.errors.positive_values_required") if index <= 1

      wahl = wahl_factor(index)
      rate = (g * (d**4)) / (8.0 * (mean_d**3) * active)

      load = number_or_zero("load_n", aliases: %w[load force_n force])
      deflection = number_or_zero("deflection_mm", aliases: %w[deflection])
      if load <= 0 && deflection.positive? && rate.positive?
        load = rate * deflection
      elsif deflection <= 0 && load.positive? && rate.positive?
        deflection = load / rate
      end

      free_length = optional_number("free_length_mm", aliases: %w[free_length freeLength])
      total_coils =
        optional_number("total_coils", aliases: %w[totalCoils]) ||
          (active + (end_type == "fixed" ? 2.0 : 1.0))
      solid_height = d * (end_type == "fixed" ? total_coils : total_coils + 1.5)
      free_length ||= solid_height + 3.0 * d

      install_h = optional_number("install_height_mm", aliases: %w[install_height installHeight])
      working_h = optional_number("working_height_mm", aliases: %w[working_height workingHeight])

      if %w[full professional].include?(calc_mode) && working_h
        design_deflection = free_length - working_h
        design_force = rate * design_deflection
      else
        design_force = load
        design_deflection = deflection
      end

      tau = shear_stress(design_force, d, mean_d, wahl)
      shear_pass = tau <= allow
      index_pass = index >= 4.0

      result = {
        "calc_mode" => calc_mode,
        "material" => material_key,
        "wire_diameter_mm" => d,
        "mean_diameter_mm" => mean_d,
        "outer_diameter_mm" => outer_d,
        "active_coils" => active,
        "total_coils" => total_coils,
        "spring_rate_n_per_mm" => rate,
        "shear_modulus_mpa" => g,
        "force_n" => design_force,
        "deflection_mm" => design_deflection,
        "shear_stress_mpa" => tau,
        "wahl_factor" => wahl,
        "spring_index" => index,
        "allowable_shear_mpa" => allow,
        "shear_pass" => shear_pass,
        "index_pass" => index_pass,
        "solid_height_mm" => solid_height,
        "free_length_mm" => free_length,
        "unwind_length_mm" => Math::PI * mean_d * total_coils,
        "tensile_strength_mpa" => rm,
      }

      if calc_mode == "simple"
        result.merge!(
          "pass" => false,
          "estimate_only" => true,
        )
        return result
      end

      if install_h && rate.positive?
        result["install_load_n"] = rate * (free_length - install_h)
        result["tau_install_mpa"] = shear_stress(result["install_load_n"], d, mean_d, wahl)
      end
      if working_h && rate.positive?
        result["working_load_n"] = design_force
        result["tau_working_mpa"] = tau
      end

      max_deflection = [free_length - solid_height - d, 0.0].max
      solid_pass = design_deflection <= max_deflection
      result["max_deflection_mm"] = max_deflection
      result["remaining_deflection_mm"] = max_deflection - design_deflection
      result["solid_pass"] = solid_pass

      buckling = buckling_check(free_length, mean_d, end_type, rate, design_force)
      result["buckling"] = buckling

      test_factor = mat[:test_factor]
      test_factor *= 0.9 if d < 1.0
      tau_s = test_factor * rm
      test_load = (Math::PI * (d**3) * tau_s) / (8.0 * mean_d)
      solid_load = rate.positive? && free_length > solid_height ? rate * (free_length - solid_height) : nil
      capped = solid_load && test_load > solid_load
      if capped
        test_load = solid_load
        tau_s = (8.0 * test_load * mean_d) / (Math::PI * (d**3))
      end
      test_deflection = rate.positive? ? test_load / rate : 0.0
      char_ratio = test_deflection.positive? ? design_deflection / test_deflection : nil
      characteristic_pass =
        char_ratio && char_ratio >= 0.2 && char_ratio <= 0.8 && design_force <= test_load

      result.merge!(
        "test_shear_stress_mpa" => tau_s,
        "test_load_n" => test_load,
        "test_deflection_mm" => test_deflection,
        "test_load_capped" => !!capped,
        "characteristic_ratio" => char_ratio,
        "characteristic_pass" => !!characteristic_pass,
      )

      natural_freq =
        (3.56 * d * Math.sqrt(g / DENSITY)) / (active * (mean_d**2))
      excitation = number_or_zero("excitation_frequency_hz", aliases: %w[excitation_frequency excitationFrequency])
      resonance_ratio = excitation.positive? && natural_freq.positive? ? natural_freq / excitation : nil
      resonance_pass = excitation <= 0 || (resonance_ratio && resonance_ratio > 10.0)
      result.merge!(
        "natural_frequency_hz" => natural_freq,
        "excitation_frequency_hz" => excitation,
        "resonance_ratio" => resonance_ratio,
        "resonance_pass" => resonance_pass,
      )

      overall =
        shear_pass && index_pass && solid_pass && buckling["pass"] && characteristic_pass &&
          resonance_pass

      if calc_mode == "professional"
        f_min = number_or_zero("load_min_n", aliases: %w[load_min loadMin])
        f_max = number_or_zero("load_max_n", aliases: %w[load_max loadMax])
        if install_h && working_h && rate.positive?
          f_min = rate * (free_length - install_h)
          f_max = rate * (free_length - working_h)
        end
        f_max = design_force if f_max <= 0 && design_force.positive?
        target_cycles =
          optional_number("target_cycles", aliases: %w[targetCycles]) || 1_000_000.0
        min_safety = optional_number("fatigue_safety", aliases: %w[fatigueSafety]) || 1.1

        if f_max > 0 && f_min >= 0 && f_max >= f_min
          tau_min = shear_stress(f_min, d, mean_d, wahl)
          tau_max = shear_stress(f_max, d, mean_d, wahl)
          tau_u0 = pulsating_limit(target_cycles, rm)
          safety = (tau_u0 + 0.75 * tau_min) / tau_max
          fatigue_pass = safety >= min_safety
          result.merge!(
            "load_min_n" => f_min,
            "load_max_n" => f_max,
            "shear_amplitude_mpa" => (tau_max - tau_min) / 2.0,
            "shear_mean_mpa" => (tau_max + tau_min) / 2.0,
            "fatigue_tau_u0_mpa" => tau_u0,
            "fatigue_safety_factor" => safety,
            "fatigue_min_safety" => min_safety,
            "fatigue_target_cycles" => target_cycles,
            "fatigue_pass" => fatigue_pass,
          )
          overall &&= fatigue_pass
        else
          result["fatigue_pass"] = false
          overall = false
        end
      end

      result.merge!("pass" => overall, "estimate_only" => false)
      result
    end

    private

    def wahl_factor(index)
      ((4.0 * index - 1.0) / (4.0 * index - 4.0)) + (0.615 / index)
    end

    def shear_stress(force, wire_d, mean_d, wahl)
      return 0.0 if force <= 0 || wire_d <= 0
      (8.0 * force * mean_d) / (Math::PI * (wire_d**3)) * wahl
    end

    def buckling_check(free_length, mean_d, end_type, rate, max_load)
      slenderness = free_length / mean_d
      limit = BUCKLING_LIMITS[end_type] || BUCKLING_LIMITS["fixed"]
      if slenderness < 0.8
        pass = false
        mode = "too_short"
      elsif slenderness <= limit
        pass = true
        mode = "slenderness"
      else
        # Simplified: outside table → fail unless load is tiny
        pass = max_load <= 0
        mode = "critical_load"
      end
      {
        "slenderness" => slenderness,
        "critical_slenderness" => limit,
        "support_type" => end_type,
        "check_mode" => mode,
        "pass" => pass,
      }
    end

    def pulsating_limit(target_cycles, rm)
      factor = TAU_U0_RM_LEVELS.first[:factor]
      TAU_U0_RM_LEVELS.each { |level| factor = level[:factor] if target_cycles >= level[:cycles] }
      factor * rm
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

    def normalize_end_type(raw)
      type = raw.to_s.presence || "fixed"
      case type
      when "fixed", "guided", "free", "rotating" then type
      else "fixed"
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
