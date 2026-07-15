# frozen_string_literal: true

module DiscourseMechbox
  # Parallel key connection strength (GB/T 1096 simplified).
  # Ported from MechBox/src/utils/key-calc.js
  class KeyCalculator
    class Error < StandardError
    end

    KEY_SIZE_TABLE = [
      { d_min: 6, d_max: 8, width: 2.0, height: 2.0 },
      { d_min: 8, d_max: 10, width: 3.0, height: 3.0 },
      { d_min: 10, d_max: 12, width: 4.0, height: 4.0 },
      { d_min: 12, d_max: 17, width: 5.0, height: 5.0 },
      { d_min: 17, d_max: 22, width: 6.0, height: 6.0 },
      { d_min: 22, d_max: 30, width: 8.0, height: 7.0 },
      { d_min: 30, d_max: 38, width: 10.0, height: 8.0 },
      { d_min: 38, d_max: 44, width: 12.0, height: 8.0 },
      { d_min: 44, d_max: 50, width: 14.0, height: 9.0 },
    ].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def self.lookup_key_size(shaft_diameter)
      row =
        KEY_SIZE_TABLE.find do |r|
          shaft_diameter >= r[:d_min] && shaft_diameter <= r[:d_max]
        end
      row || KEY_SIZE_TABLE.last
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      shaft_d = positive_number("shaft_diameter_mm", aliases: %w[shaft_diameter shaftDiameter])
      std = self.class.lookup_key_size(shaft_d)

      key_width =
        optional_number("key_width_mm", aliases: %w[key_width keyWidth]) || std[:width]
      key_height =
        optional_number("key_height_mm", aliases: %w[key_height keyHeight]) || std[:height]
      key_length =
        optional_number("key_length_mm", aliases: %w[key_length keyLength]) ||
          (std[:width] * 3.5)
      hub_length =
        optional_number("hub_length_mm", aliases: %w[hub_length hubLength]) || key_length

      raise Error, I18n.t("mechbox.errors.positive_values_required") if [key_width, key_height, key_length, hub_length].any? { |v| v <= 0 }

      torque = number_or_zero("torque_nm", aliases: %w[torque])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "torque_nm") if torque < 0

      key_count =
        if calc_mode == "professional"
          count = (optional_number("key_count", aliases: %w[keyCount]) || 1.0).round
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "key_count") if count < 1 || count > 2
          count
        else
          1
        end

      allow_tau = optional_number("allow_shear_mpa", aliases: %w[allow_shear allowShear]) || 100.0
      allow_crush = optional_number("allow_crush_mpa", aliases: %w[allow_crush allowCrush]) || 150.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if allow_tau <= 0 || allow_crush <= 0

      force = tangential_force(torque, shaft_d)
      force_per_key = force / key_count
      tau = shear_stress(force_per_key, key_width, key_length)
      sigma_c = crush_stress(force_per_key, key_height, hub_length)

      shear_pass = tau <= allow_tau
      crush_pass = sigma_c <= allow_crush

      result = {
        "calc_mode" => calc_mode,
        "shaft_diameter_mm" => shaft_d,
        "torque_nm" => torque,
        "tangential_force_n" => force,
        "force_per_key_n" => force_per_key,
        "key_width_mm" => key_width,
        "key_height_mm" => key_height,
        "key_length_mm" => key_length,
        "hub_length_mm" => hub_length,
        "key_count" => key_count,
        "std_key_width_mm" => std[:width],
        "std_key_height_mm" => std[:height],
        "shear_stress_mpa" => tau,
        "crush_stress_mpa" => sigma_c,
        "allow_shear_mpa" => allow_tau,
        "allow_crush_mpa" => allow_crush,
        "shear_pass" => shear_pass,
        "crush_pass" => crush_pass,
      }

      if %w[full professional].include?(calc_mode)
        min_len_shear = key_width.positive? ? force_per_key / (key_width * allow_tau) : 0.0
        min_len_crush = key_height.positive? ? (2.0 * force_per_key) / (key_height * allow_crush) : 0.0
        recommended = [min_len_shear, min_len_crush].max
        length_pass = key_length >= recommended

        result.merge!(
          "shear_utilization" => allow_tau.positive? ? tau / allow_tau : 0.0,
          "crush_utilization" => allow_crush.positive? ? sigma_c / allow_crush : 0.0,
          "min_key_length_shear_mm" => min_len_shear,
          "min_key_length_crush_mm" => min_len_crush,
          "recommended_length_mm" => recommended,
          "length_pass" => length_pass,
        )
        overall = shear_pass && crush_pass && length_pass
      else
        overall = false
      end

      if calc_mode == "professional"
        t_amp = number_or_zero("torque_amplitude_nm", aliases: %w[torque_amplitude torqueAmplitude])
        if t_amp.positive?
          f_amp = tangential_force(t_amp, shaft_d) / key_count
          tau_amp = shear_stress(f_amp, key_width, key_length)
          t_mean =
            optional_number("torque_mean_nm", aliases: %w[torque_mean torqueMean]) ||
              [0.0, torque - t_amp].max
          f_mean = tangential_force(t_mean, shaft_d) / key_count
          tau_mean = shear_stress(f_mean, key_width, key_length)
          # Lightweight fatigue gate (full S-N deferred): amplitude vs 50% of allow shear.
          fatigue_limit = allow_tau * 0.5
          fatigue_pass = tau_amp <= fatigue_limit

          result.merge!(
            "torque_amplitude_nm" => t_amp,
            "torque_mean_nm" => t_mean,
            "shear_amplitude_mpa" => tau_amp,
            "shear_mean_mpa" => tau_mean,
            "fatigue_limit_mpa" => fatigue_limit,
            "fatigue_pass" => fatigue_pass,
          )
          overall &&= fatigue_pass
        end

        fos = optional_number("required_safety_factor", aliases: %w[requiredSafetyFactor])
        if fos && fos.positive?
          fos_pass = tau <= (allow_tau / fos) && sigma_c <= (allow_crush / fos)
          result["required_safety_factor"] = fos
          result["safety_factor_pass"] = fos_pass
          overall &&= fos_pass
        end
      end

      result.merge!(
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

    def tangential_force(torque_nm, shaft_diameter_mm)
      return 0.0 if shaft_diameter_mm <= 0
      (torque_nm * 2000.0) / shaft_diameter_mm
    end

    def shear_stress(force, key_width, key_length)
      area = key_width * key_length
      return 0.0 if area <= 0
      force / area
    end

    def crush_stress(force, key_height, hub_length)
      area = key_height * (hub_length / 2.0)
      return 0.0 if area <= 0
      force / area
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
