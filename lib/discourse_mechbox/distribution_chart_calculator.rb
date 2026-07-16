# frozen_string_literal: true

module DiscourseMechbox
  # Distribution PDF summary (numbers first; chart later).
  # Ported from MechBox/src/utils/distribution-pdf.js + DISTRIBUTIONS in size-chain.js.
  class DistributionChartCalculator
    class Error < StandardError
    end

    SQRT2PI = Math.sqrt(2.0 * Math::PI)

    DISTRIBUTIONS = {
      "normal" => { k: 6.0, cv: 1.0, coverage: 0.9973 },
      "uniform" => { k: 3.46, cv: 0.577, coverage: 1.0 },
      "rectangular" => { k: 3.46, cv: 0.577, coverage: 1.0 },
      "triangular" => { k: 4.24, cv: 0.707, coverage: 0.95 },
      "skewed" => { k: 5.0, cv: 0.8, coverage: 0.98 },
    }.freeze

    CURVE_POINTS = 21

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      distribution = normalize_distribution(@inputs["distribution"] || @inputs["distribution_type"])
      distribution = "normal" if calc_mode == "simple"

      dist = DISTRIBUTIONS[distribution]
      tolerance = positive_number("tolerance", aliases: %w[tolerance_mm chartTolerance value])

      k =
        if calc_mode == "professional"
          optional_number("k_factor", aliases: %w[kFactor custom_k]) || dist[:k]
        else
          dist[:k]
        end
      raise Error, I18n.t("mechbox.errors.positive_values_required") if k <= 0

      mean =
        if calc_mode == "professional"
          optional_number("mean", aliases: %w[mu process_mean]) || 0.0
        else
          0.0
        end

      sigma_override = optional_number("sigma", aliases: %w[process_sigma])
      sigma =
        if calc_mode == "professional" && !sigma_override.nil?
          raise Error, I18n.t("mechbox.errors.positive_values_required") if sigma_override <= 0

          sigma_override
        else
          tolerance / k
        end

      half_width = tolerance / 2.0
      peak_density = pdf_at(distribution, mean, mean, sigma, half_width)

      result = {
        "calc_mode" => calc_mode,
        "distribution" => distribution,
        "tolerance" => tolerance,
        "mean" => mean,
        "sigma" => sigma,
        "k_factor" => k,
        "half_width" => half_width,
        "peak_density" => peak_density,
        "cv" => dist[:cv],
        "coverage" => dist[:coverage],
        "pdf_at_zero" => pdf_at(distribution, 0.0, mean, sigma, half_width),
        "pdf_at_plus_sigma" => pdf_at(distribution, mean + sigma, mean, sigma, half_width),
        "pdf_at_plus_2sigma" => pdf_at(distribution, mean + 2.0 * sigma, mean, sigma, half_width),
        "pdf_at_plus_3sigma" => pdf_at(distribution, mean + 3.0 * sigma, mean, sigma, half_width),
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      curve = build_curve(distribution, mean, sigma, half_width, tolerance)
      result.merge!(
        "curve_points" => curve,
        "curve_point_count" => curve.length,
        "pass" => true,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        lsl = optional_number("lsl", aliases: %w[spec_lower lower_spec])
        usl = optional_number("usl", aliases: %w[spec_upper upper_spec])
        if lsl && usl
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "usl") if usl <= lsl

          pass_rate = normal_pass_rate(lsl, usl, mean, sigma)
          result.merge!(
            "lsl" => lsl,
            "usl" => usl,
            "pass_rate" => pass_rate,
            "dppm" => ((1.0 - pass_rate) * 1_000_000).round,
          )
        end
      end

      result
    end

    private

    def build_curve(type, mean, sigma, half_width, tolerance)
      span = type == "normal" ? tolerance * 2.0 : tolerance * 1.2
      points = CURVE_POINTS
      (0..points).map do |i|
        xi = mean - span / 2.0 + (span * i) / points
        {
          "x" => round(xi, 4),
          "y" => round(pdf_at(type, xi, mean, sigma, half_width), 6),
        }
      end
    end

    def pdf_at(type, x, mean, sigma, half_width)
      case type
      when "uniform", "rectangular"
        rectangular_pdf(x, mean, half_width)
      when "triangular"
        triangular_pdf(x, mean, half_width)
      when "skewed"
        skewed_pdf(x, mean, sigma)
      else
        normal_pdf(x, mean, sigma)
      end
    end

    def normal_pdf(x, mu, sigma)
      return 0.0 if sigma <= 0

      (1.0 / (sigma * SQRT2PI)) * Math.exp(-0.5 * ((x - mu) / sigma)**2)
    end

    def rectangular_pdf(x, mu, half_width)
      return 0.0 if half_width <= 0

      a = mu - half_width
      b = mu + half_width
      return 0.0 if x < a || x > b

      1.0 / (b - a)
    end

    def triangular_pdf(x, mu, half_width)
      return 0.0 if half_width <= 0

      a = mu - half_width
      b = mu + half_width
      return 0.0 if x < a || x > b

      peak = 1.0 / half_width
      x <= mu ? peak * (x - a) / half_width : peak * (b - x) / half_width
    end

    def skewed_pdf(x, mu, sigma)
      shifted = x - mu + sigma
      return 0.0 if shifted <= 0

      s = (sigma * 0.6).nonzero? || 0.1
      m = Math.log(shifted)
      (1.0 / (shifted * s * SQRT2PI)) * Math.exp(-((m - Math.log(sigma))**2) / (2.0 * s * s))
    rescue Math::DomainError, Errno::EDOM
      0.0
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

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
