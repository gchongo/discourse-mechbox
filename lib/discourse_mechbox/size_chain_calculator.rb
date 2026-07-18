# frozen_string_literal: true

module DiscourseMechbox
  class SizeChainCalculator
    class Error < StandardError
    end

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      closed_ring = normalize_closed_ring
      rings = normalize_rings
      worst = worst_case_limits(rings, closed_ring)
      rss = rss_limits(rings, closed_ring)
      contributions = ring_contributions(rings)
      warnings = []
      warnings << "rss_pass_worst_fail" if rss["pass"] && !worst["pass"]
      warnings << "worst_case_fail" unless worst["pass"]

      {
        "closed_ring" => closed_ring,
        "nominal" => rss["nominal"],
        "worst" => worst,
        "rss" => rss,
        "active_method" => "rss",
        "pass" => rss["pass"],
        "estimate_only" => true,
        "margin_lower" => round(rss["lower"] - closed_ring["min"]),
        "margin_upper" => round(closed_ring["max"] - rss["upper"]),
        "worst_margin" => [worst["lower"] - closed_ring["min"], closed_ring["max"] - worst["upper"]].min.then { |v| round(v) },
        "ring_contributions" => contributions,
        "warnings" => warnings,
      }
    end

    private

    def normalize_closed_ring
      raw = @inputs["closed_ring"] || @inputs["closedRing"]
      hash = raw.respond_to?(:to_h) ? raw.to_h.transform_keys(&:to_s) : {}
      min = number(hash["min"], "closed_ring.min")
      max = number(hash["max"], "closed_ring.max")
      raise invalid("closed_ring") if max < min

      {
        "name" => hash["name"].to_s.presence || "L0",
        "min" => min,
        "max" => max,
        "target" => round((min + max) / 2.0),
        "tolerance" => round(max - min),
        "unit" => hash["unit"].to_s.presence || "mm",
      }
    end

    def normalize_rings
      raw = @inputs["component_rings"] || @inputs["componentRings"]
      raise invalid("component_rings") unless raw.respond_to?(:to_a)

      rings = raw.to_a.map.with_index { |ring, index| normalize_ring(ring, index) }
      raise invalid("component_rings") if rings.empty?

      rings
    end

    def normalize_ring(raw, index)
      hash = raw.respond_to?(:to_h) ? raw.to_h.transform_keys(&:to_s) : {}
      type = hash["type"].to_s
      raise invalid("component_rings[#{index}].type") unless %w[increasing decreasing].include?(type)

      factor = optional_number(hash["factor"], "component_rings[#{index}].factor") || 1.0
      raise invalid("component_rings[#{index}].factor") if factor <= 0

      size = number(hash["size"] || hash["nominal_size"], "component_rings[#{index}].size")
      es, ei = deviations(hash, index)
      raise invalid("component_rings[#{index}].deviation") if es < ei

      {
        "name" => hash["name"].to_s.presence || "环 #{index + 1}",
        "type" => type,
        "factor" => factor,
        "size" => size,
        "nominal" => size * factor,
        "es" => es * factor,
        "ei" => ei * factor,
        "mean_dev" => (es + ei) * factor / 2.0,
        "tolerance" => (es - ei) * factor,
      }
    end

    def deviations(hash, index)
      if hash["es"].present? || hash["ei"].present?
        [number(hash["es"], "component_rings[#{index}].es"), number(hash["ei"], "component_rings[#{index}].ei")]
      else
        tolerance =
          number(
            hash["tolerance"] || hash["total_tolerance"],
            "component_rings[#{index}].tolerance",
          )
        raise invalid("component_rings[#{index}].tolerance") if tolerance < 0

        [tolerance / 2.0, -tolerance / 2.0]
      end
    end

    def worst_case_limits(rings, closed_ring)
      upper = 0.0
      lower = 0.0
      rings.each do |ring|
        if ring["type"] == "increasing"
          upper += ring["nominal"] + ring["es"]
          lower += ring["nominal"] + ring["ei"]
        else
          upper -= ring["nominal"] + ring["ei"]
          lower -= ring["nominal"] + ring["es"]
        end
      end
      limits(upper:, lower:, closed_ring:)
    end

    def rss_limits(rings, closed_ring)
      nominal = rings.sum do |ring|
        sign = ring["type"] == "increasing" ? 1.0 : -1.0
        sign * (ring["nominal"] + ring["mean_dev"])
      end
      tolerance = Math.sqrt(rings.sum { |ring| ring["tolerance"]**2 })
      limits(upper: nominal + tolerance / 2.0, lower: nominal - tolerance / 2.0, closed_ring:)
    end

    def limits(upper:, lower:, closed_ring:)
      {
        "nominal" => round((upper + lower) / 2.0),
        "upper" => round(upper),
        "lower" => round(lower),
        "total_tolerance" => round(upper - lower),
        "pass" => lower >= closed_ring["min"] && upper <= closed_ring["max"],
      }
    end

    def ring_contributions(rings)
      total = rings.sum { |ring| ring["tolerance"]**2 }
      rings.map do |ring|
        {
          "name" => ring["name"],
          "type" => ring["type"],
          "tolerance" => round(ring["tolerance"]),
          "percent" => round(total.zero? ? 0.0 : ring["tolerance"]**2 / total * 100.0),
        }
      end
    end

    def optional_number(value, field)
      return nil if value.nil? || value == ""

      Float(value)
    rescue ArgumentError, TypeError
      raise invalid(field)
    end

    def number(value, field)
      optional_number(value, field) || raise(invalid(field))
    end

    def invalid(field)
      Error.new(I18n.t("mechbox.errors.invalid_input", field:))
    end

    def round(value)
      (value * 1_000_000).round / 1_000_000.0
    end
  end
end
