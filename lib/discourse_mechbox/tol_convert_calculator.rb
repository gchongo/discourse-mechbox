# frozen_string_literal: true

module DiscourseMechbox
  # Tolerance ↔ sigma conversion (T = K·σ).
  # Ported from MechBox/src/utils/size-chain.js (toleranceToSigma / sigmaToTolerance).
  class TolConvertCalculator
    class Error < StandardError
    end

    DISTRIBUTIONS = {
      "normal" => { k: 6.0, cv: 1.0, coverage: 0.9973 },
      "uniform" => { k: 3.46, cv: 0.577, coverage: 1.0 },
      "rectangular" => { k: 3.46, cv: 0.577, coverage: 1.0 },
      "triangular" => { k: 4.24, cv: 0.707, coverage: 0.95 },
      "skewed" => { k: 5.0, cv: 0.8, coverage: 0.98 },
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      direction = normalize_direction(@inputs["direction"])
      distribution = normalize_distribution(@inputs["distribution"] || @inputs["distribution_type"])
      value = positive_number("value", aliases: %w[input_value inputValue])

      dist = DISTRIBUTIONS[distribution]
      k =
        if calc_mode == "professional"
          optional_number("k_factor", aliases: %w[k_factor kFactor custom_k]) || dist[:k]
        elsif calc_mode == "simple"
          DISTRIBUTIONS["normal"][:k]
        else
          dist[:k]
        end

      raise Error, I18n.t("mechbox.errors.positive_values_required") if k <= 0

      if calc_mode == "simple"
        distribution = "normal"
        dist = DISTRIBUTIONS["normal"]
      end

      if direction == "t2s"
        input_tolerance = value
        output_sigma = value / k
        input_sigma = nil
        output_tolerance = nil
      else
        input_sigma = value
        output_tolerance = value * k
        input_tolerance = nil
        output_sigma = nil
      end

      result = {
        "calc_mode" => calc_mode,
        "direction" => direction,
        "distribution" => distribution,
        "k_factor" => k,
        "cv" => dist[:cv],
        "coverage" => dist[:coverage],
        "value" => value,
        "input_tolerance" => input_tolerance,
        "output_sigma" => output_sigma,
        "input_sigma" => input_sigma,
        "output_tolerance" => output_tolerance,
        "result" => direction == "t2s" ? output_sigma : output_tolerance,
      }

      if calc_mode == "simple"
        result.merge!("pass" => false, "estimate_only" => true)
      else
        result.merge!("pass" => true, "estimate_only" => false)
      end

      result
    end

    private

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

    def normalize_direction(raw)
      direction = raw.to_s.presence || "t2s"
      case direction
      when "t2s", "t_to_s", "tolerance_to_sigma" then "t2s"
      when "s2t", "s_to_t", "sigma_to_tolerance" then "s2t"
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "direction")
      end
    end

    def normalize_distribution(raw)
      key = raw.to_s.presence || "normal"
      return key if DISTRIBUTIONS.key?(key)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "distribution")
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
  end
end
