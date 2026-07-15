# frozen_string_literal: true

module DiscourseMechbox
  # Bolt preload calculators: simple / VDI 2230 / professional.
  # Ported from MechBox/src/utils/bolt-preload-calc.js
  class BoltPreloadCalculator
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

    BOLT_GRADES = {
      "4.6" => { allow_stress: 160.0 },
      "4.8" => { allow_stress: 200.0 },
      "5.6" => { allow_stress: 190.0 },
      "8.8" => { allow_stress: 400.0 },
      "10.9" => { allow_stress: 560.0 },
      "12.9" => { allow_stress: 630.0 },
    }.freeze

    DEFAULT_E_MODULUS = { "steel" => 206_000.0, "aluminum" => 70_000.0 }.freeze

    EMBEDMENT_PRESETS = {
      "steel_standard" => 11.0,
      "steel_fine" => 7.0,
      "aluminum" => 15.0,
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = @inputs["calc_mode"].to_s.presence || "simple"
      mode = @inputs["mode"].to_s.presence || "torque2force"
      grade = @inputs["grade"].to_s.presence || "8.8"
      d = positive_number("nominal_diameter_mm")
      grade_meta = BOLT_GRADES[grade]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "grade") if grade_meta.blank?

      pitch = optional_number("pitch_mm") || METRIC_THREAD_PITCH[d.round] || 1.5
      raise Error, I18n.t("mechbox.errors.positive_values_required") if pitch <= 0

      as = tensile_stress_area(d, pitch)
      d2 = pitch_diameter(d, pitch)
      allow = grade_meta[:allow_stress]

      case calc_mode
      when "simple"
        result = calculate_simple(mode:, d:, pitch:, as:, allow:, grade:)
      when "full", "vdi2230"
        result = calculate_vdi(mode:, d:, pitch:, as:, d2:, allow:, grade:)
      when "professional"
        result = calculate_professional(mode:, d:, pitch:, as:, d2:, allow:, grade:)
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
      end

      result
    end

    private

    def calculate_simple(mode:, d:, pitch:, as:, allow:, grade:)
      k = positive_number("nut_factor")

      torque, preload =
        case mode
        when "torque2force"
          t = positive_number("torque_nm")
          [t, t / (k * d / 1000.0)]
        when "force2torque"
          f = positive_number("preload_n")
          [k * f * d / 1000.0, f]
        else
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "mode")
        end

      stress = as.positive? ? preload / as : 0.0
      max_preload = allow * as
      pass = preload.positive? && stress <= allow

      base_result(
        calc_mode: "simple",
        mode:,
        grade:,
        pitch:,
        preload:,
        torque:,
        as:,
        stress:,
        allow:,
        max_preload:,
        pass:,
        estimate_only: true,
      ).merge(
        "nut_factor" => k,
        "compare_torque_nm" => calc_tightening_torque_vdi(preload, d, pitch, 0.12, 0.12, 1.45 * d),
      )
    end

    def calculate_vdi(mode:, d:, pitch:, as:, d2:, allow:, grade:)
      mu_g = optional_number("mu_g") || 0.12
      mu_k = optional_number("mu_k") || 0.12
      d_km = optional_number("d_km") || (1.45 * d)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if mu_g <= 0 || mu_k <= 0 || d_km <= 0

      factor = torque_factor_vdi(pitch, d2, d_km, mu_g, mu_k)

      torque, preload =
        case mode
        when "torque2force"
          t = positive_number("torque_nm")
          [t, (t * 1000.0) / factor]
        when "force2torque"
          f = positive_number("preload_n")
          [(f * factor) / 1000.0, f]
        else
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "mode")
        end

      breakdown = torque_breakdown_vdi(preload, pitch, d2, d_km, mu_g, mu_k)
      stress = as.positive? ? preload / as : 0.0
      max_preload = allow * as
      pass = preload.positive? && stress <= allow
      simple_torque = (0.2 * d * preload) / 1000.0

      base_result(
        calc_mode: "full",
        mode:,
        grade:,
        pitch:,
        preload:,
        torque:,
        as:,
        stress:,
        allow:,
        max_preload:,
        pass:,
        estimate_only: false,
      ).merge(
        "pitch_diameter_mm" => d2,
        "mu_g" => mu_g,
        "mu_k" => mu_k,
        "d_km" => d_km,
        "torque_thread_nm" => breakdown[:thread],
        "torque_head_nm" => breakdown[:head],
        "compare_torque_nm" => simple_torque,
        "compare_label" => "simple",
      )
    end

    def calculate_professional(mode:, d:, pitch:, as:, d2:, allow:, grade:)
      mu_g = optional_number("mu_g") || 0.12
      mu_k = optional_number("mu_k") || 0.12
      d_km = optional_number("d_km") || (1.45 * d)
      grip = optional_number("grip_length") || (d * 2.0)
      hole = optional_number("hole_diameter") || (d + 1.0)
      head_contact = optional_number("head_contact_diameter") || (1.5 * d)
      outer = optional_number("outer_diameter") || (head_contact + 1.4 * grip)
      e_bolt = optional_number("e_modulus_bolt") || DEFAULT_E_MODULUS["steel"]
      e_plate = optional_number("e_modulus_plate") || DEFAULT_E_MODULUS["steel"]
      embedment_um =
        if @inputs["embedment_um"].present?
          numeric("embedment_um")
        else
          preset = @inputs["embedment_preset"].to_s.presence || "steel_standard"
          EMBEDMENT_PRESETS[preset] || EMBEDMENT_PRESETS["steel_standard"]
        end
      delta_t = optional_number("delta_t") || 0.0
      alpha_bolt = optional_number("alpha_bolt") || 12e-6
      alpha_plate = optional_number("alpha_plate") || 12e-6
      external = optional_number("external_axial_load") || 0.0

      if [mu_g, mu_k, d_km, grip, hole, head_contact, outer, e_bolt, e_plate].any? { |v| v <= 0 }
        raise Error, I18n.t("mechbox.errors.positive_values_required")
      end

      embedment_mm = embedment_um / 1000.0
      delta_s = grip / (e_bolt * as)
      plate_area = (Math::PI / 4.0) * (outer**2 - hole**2)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if plate_area <= 0

      delta_p = grip / (e_plate * plate_area)
      k_s = delta_s.positive? ? 1.0 / delta_s : 0.0
      k_p = delta_p.positive? ? 1.0 / delta_p : 0.0
      load_factor = (k_s + k_p).positive? ? k_s / (k_s + k_p) : 0.0
      embedment_loss =
        (delta_s + delta_p).positive? && embedment_mm.positive? ? embedment_mm / (delta_s + delta_p) : 0.0
      thermal_delta =
        if (delta_s + delta_p).positive? && !delta_t.zero?
          ((alpha_bolt - alpha_plate) * delta_t * grip) / (delta_s + delta_p)
        else
          0.0
        end

      factor = torque_factor_vdi(pitch, d2, d_km, mu_g, mu_k)

      case mode
      when "torque2force"
        torque = positive_number("torque_nm")
        preload_tightening = (torque * 1000.0) / factor
        preload_residual = preload_tightening - embedment_loss + thermal_delta
      when "force2torque"
        # Input preload is the target residual preload.
        preload_residual = positive_number("preload_n")
        preload_tightening = preload_residual + embedment_loss - thermal_delta
        torque = (preload_tightening * factor) / 1000.0
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "mode")
      end

      stress_tightening = as.positive? ? preload_tightening / as : 0.0
      stress_residual = as.positive? ? preload_residual / as : 0.0
      max_preload = allow * as

      fa = [external, 0.0].max
      clamp_remaining = preload_residual - fa * (1.0 - load_factor)
      max_bolt_force = preload_residual + load_factor * fa
      stress_under_load = as.positive? ? max_bolt_force / as : 0.0
      separation_pass = clamp_remaining >= 0

      pass =
        preload_tightening.positive? && preload_residual.positive? && stress_tightening <= allow &&
          stress_residual <= allow
      if fa.positive?
        pass &&= separation_pass && stress_under_load <= allow
      end

      breakdown = torque_breakdown_vdi(preload_tightening, pitch, d2, d_km, mu_g, mu_k)
      simple_torque = (0.2 * d * preload_tightening) / 1000.0

      base_result(
        calc_mode: "professional",
        mode:,
        grade:,
        pitch:,
        preload: preload_residual,
        torque:,
        as:,
        stress: stress_tightening,
        allow:,
        max_preload:,
        pass:,
        estimate_only: false,
      ).merge(
        "pitch_diameter_mm" => d2,
        "preload_tightening_n" => preload_tightening,
        "preload_residual_n" => preload_residual,
        "stress_residual_mpa" => stress_residual,
        "mu_g" => mu_g,
        "mu_k" => mu_k,
        "d_km" => d_km,
        "torque_thread_nm" => breakdown[:thread],
        "torque_head_nm" => breakdown[:head],
        "grip_length" => grip,
        "hole_diameter" => hole,
        "head_contact_diameter" => head_contact,
        "outer_diameter" => outer,
        "embedment_um" => embedment_um,
        "embedment_loss_n" => embedment_loss,
        "thermal_delta_n" => thermal_delta,
        "delta_s" => delta_s,
        "delta_p" => delta_p,
        "k_s" => k_s,
        "k_p" => k_p,
        "load_factor" => load_factor,
        "external_axial_load" => fa,
        "clamping_force_remaining" => clamp_remaining,
        "max_bolt_force" => max_bolt_force,
        "stress_under_load_mpa" => stress_under_load,
        "separation_pass" => separation_pass,
        "compare_torque_nm" => simple_torque,
        "compare_label" => "simple",
      )
    end

    def base_result(
      calc_mode:,
      mode:,
      grade:,
      pitch:,
      preload:,
      torque:,
      as:,
      stress:,
      allow:,
      max_preload:,
      pass:,
      estimate_only:
    )
      {
        "calc_mode" => calc_mode,
        "mode" => mode,
        "grade" => grade,
        "pitch_mm" => pitch,
        "preload_n" => preload,
        "preload_kn" => preload / 1000.0,
        "torque_nm" => torque,
        "stress_area_mm2" => as,
        "stress_mpa" => stress,
        "allow_stress_mpa" => allow,
        "max_preload_n" => max_preload,
        "pass" => pass,
        "estimate_only" => estimate_only,
      }
    end

    def tensile_stress_area(d, pitch)
      d_eff = d - 0.9382 * pitch
      (Math::PI / 4.0) * (d_eff**2)
    end

    def pitch_diameter(d, pitch)
      d - 0.6495 * pitch
    end

    def torque_factor_vdi(pitch, d2, d_km, mu_g, mu_k)
      0.16 * pitch + 0.58 * d2 * mu_g + 0.5 * d_km * mu_k
    end

    def calc_tightening_torque_vdi(preload, d, pitch, mu_g, mu_k, d_km)
      d2 = pitch_diameter(d, pitch)
      (preload * torque_factor_vdi(pitch, d2, d_km, mu_g, mu_k)) / 1000.0
    end

    def torque_breakdown_vdi(preload, pitch, d2, d_km, mu_g, mu_k)
      thread = (preload * (0.16 * pitch + 0.58 * d2 * mu_g)) / 1000.0
      head = (preload * 0.5 * d_km * mu_k) / 1000.0
      { thread:, head:, total: thread + head }
    end

    def positive_number(key)
      value = numeric(key)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0
      value
    end

    def optional_number(key)
      return if @inputs[key].blank?
      numeric(key)
    end

    def numeric(key)
      Float(@inputs[key])
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end
  end
end
