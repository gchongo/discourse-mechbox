# frozen_string_literal: true

module DiscourseMechbox
  # Process capability: C / Cpk / pass rate / short-term sigma level.
  # Ported from MechBox/src/utils/process-capability.js.
  class SigmaAnalysisCalculator
    class Error < StandardError
    end

    DEFAULT_MIN_CPK = 1.33
    DEFAULT_MIN_PASS_RATE = 0.9973
    LONG_TERM_SHIFT = 1.5

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])

      lsl = number("lsl", aliases: %w[spec_lower specLower lower_spec])
      usl = number("usl", aliases: %w[spec_upper specUpper upper_spec])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "usl") if usl <= lsl

      mean, sigma =
        if calc_mode == "professional" && sample_values.any?
          stats = sample_stats(sample_values)
          [
            optional_number("mean", aliases: %w[process_mean processMean]) || stats[:mean],
            optional_number("sigma", aliases: %w[process_sigma processSigma]) || stats[:sigma],
          ]
        else
          [
            number("mean", aliases: %w[process_mean processMean]),
            positive_number("sigma", aliases: %w[process_sigma processSigma]),
          ]
        end

      raise Error, I18n.t("mechbox.errors.positive_values_required") if sigma <= 0

      tolerance = usl - lsl
      c = tolerance / (6.0 * sigma)
      cpu = (usl - mean) / (3.0 * sigma)
      cpl = (mean - lsl) / (3.0 * sigma)
      cpk = [cpu, cpl].min
      pass_rate = normal_pass_rate(lsl, usl, mean, sigma)
      dppm = ((1.0 - pass_rate) * 1_000_000).round
      sigma_level = [0.0, cpk].max * 3.0

      result = {
        "calc_mode" => calc_mode,
        "lsl" => lsl,
        "usl" => usl,
        "mean" => mean,
        "sigma" => sigma,
        "tolerance" => tolerance,
        "c" => c,
        "cpk" => cpk,
        "cpu" => cpu,
        "cpl" => cpl,
        "sigma_level" => sigma_level,
        "sigma_level_formula" => "3*Cpk",
        "pass_rate" => pass_rate,
        "dppm" => dppm,
        "tolerance_over_6sigma" => c,
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      min_cpk =
        optional_number("min_cpk", aliases: %w[minCpk cpk_target]) || DEFAULT_MIN_CPK
      min_pass_rate =
        optional_number("min_pass_rate", aliases: %w[minPassRate]) || DEFAULT_MIN_PASS_RATE

      cpk_pass = cpk >= min_cpk
      pass_rate_ok = pass_rate >= min_pass_rate
      centered = (mean - lsl).abs > 0 && (usl - mean).abs > 0 && (mean - lsl - (usl - mean)).abs < (tolerance * 0.05)

      result.merge!(
        "min_cpk" => min_cpk,
        "min_pass_rate" => min_pass_rate,
        "cpk_pass" => cpk_pass,
        "pass_rate_pass" => pass_rate_ok,
        "centered" => centered,
        "pass" => cpk_pass && pass_rate_ok,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        long_term_sigma = [0.0, sigma_level - LONG_TERM_SHIFT].max
        sample = sample_values
        result.merge!(
          "long_term_sigma_level" => long_term_sigma,
          "long_term_shift" => LONG_TERM_SHIFT,
          "sample_count" => sample.size,
          "sample_mean" => sample.any? ? sample_stats(sample)[:mean] : nil,
          "sample_sigma" => sample.any? ? sample_stats(sample)[:sigma] : nil,
        )
      end

      result
    end

    private

    def sample_values
      raw = @inputs["sample_values"] || @inputs["sampleValues"] || @inputs["samples"]
      return [] if raw.nil? || raw == ""

      values =
        if raw.is_a?(Array)
          raw
        else
          raw.to_s.split(/[\s,;，；]+/)
        end

      values.map { |v| Float(v) }.select { |n| n.finite? }
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "sample_values")
    end

    def sample_stats(values)
      raise Error, I18n.t("mechbox.errors.positive_values_required") if values.empty?

      mean = values.sum / values.length
      variance = values.sum { |x| (x - mean)**2 } / values.length
      { mean:, sigma: Math.sqrt(variance) }
    end

    def normal_pass_rate(lsl, usl, mean, sigma)
      raw = cdf_normal_at(usl, mean, sigma) - cdf_normal_at(lsl, mean, sigma)
      [[raw, 0.0].max, 1.0].min
    end

    def cdf_normal_at(x, mean, sigma)
      return x >= mean ? 1.0 : 0.0 if sigma <= 0

      cdf_normal_z((x - mean) / sigma)
    end

    def cdf_normal_z(z)
      t = 1.0 / (1.0 + 0.2316419 * z.abs)
      d = 0.3989423 * Math.exp((-z * z) / 2.0)
      p =
        d * t *
          (
            0.3193815 +
              t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))
          )
      z.positive? ? 1.0 - p : p
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

    def number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
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
  end
end
