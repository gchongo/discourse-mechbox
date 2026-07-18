# frozen_string_literal: true

module DiscourseMechbox
  # Monte Carlo size-chain simulation ported from MechBox monte-carlo.js.
  # Returns summary stats + histogram (not the full sample array).
  class MonteCarloCalculator
    class Error < StandardError
    end

    DISTRIBUTION_K = {
      "normal" => 6.0,
      "uniform" => 3.46,
      "rectangular" => 3.46,
      "triangular" => 4.24,
      "skewed" => 5.0,
    }.freeze

    MIN_ITERATIONS = 100
    MAX_ITERATIONS = 50_000
    DEFAULT_ITERATIONS = 10_000
    HISTOGRAM_BINS = 24

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      closed = normalize_closed_ring
      rings = normalize_rings
      iterations = normalize_iterations
      distribution = normalize_distribution
      custom_k = optional_number(@inputs["custom_k"] || @inputs["customK"], "custom_k") || 0.0
      truncated = truthy?(@inputs["truncated_normal"] || @inputs["truncatedNormal"], default: true)
      seed = (optional_number(@inputs["seed"], "seed") || 42).to_i & 0xffffffff
      include_sensitivity =
        truthy?(@inputs["include_sensitivity"] || @inputs["includeSensitivity"], default: true)

      rng = seeded_random(seed)
      simulation =
        run_simulation(
          closed:,
          rings:,
          iterations:,
          distribution:,
          custom_k:,
          truncated:,
          rng:,
        )

      stack = stack_comparison(closed, rings)
      warnings = []
      warnings << "rss_pass_worst_fail" if stack["rss"]["pass"] && !stack["worst"]["pass"]
      warnings << "mc_pass_worst_fail" if simulation["pass_rate"] >= 0.95 && !stack["worst"]["pass"]
      warnings << "low_pass_rate" if simulation["pass_rate"] < 0.95

      sensitivity =
        if include_sensitivity
          run_sensitivity(
            closed:,
            rings:,
            iterations: [[iterations / 2, 2000].min, 200].max,
            distribution:,
            custom_k:,
            truncated:,
            seed: (seed + 1) & 0xffffffff,
          )
        end

      {
        "closed_ring" => closed,
        "iterations" => iterations,
        "distribution" => distribution,
        "custom_k" => custom_k,
        "truncated_normal" => truncated,
        "seed" => seed,
        "nominal" => round(simulation["nominal"]),
        "mean" => round(simulation["mean"]),
        "std" => round(simulation["std"]),
        "std_population" => round(simulation["std_population"]),
        "min" => round(simulation["min"]),
        "max" => round(simulation["max"]),
        "p05" => round(simulation["p05"]),
        "p50" => round(simulation["p50"]),
        "p95" => round(simulation["p95"]),
        "pass_count" => simulation["pass_count"],
        "pass_rate" => round(simulation["pass_rate"]),
        "pass" => simulation["pass_rate"] >= 0.95,
        "histogram" => simulation["histogram"],
        "worst" => stack["worst"],
        "rss" => stack["rss"],
        "sensitivity" => sensitivity,
        "warnings" => warnings,
      }
    end

    private

    def normalize_closed_ring
      raw = @inputs["closed_ring"] || @inputs["closedRing"]
      hash =
        if raw.respond_to?(:to_h)
          raw.to_h.transform_keys(&:to_s)
        else
          {
            "min" => @inputs["closed_min"] || @inputs["closedMin"],
            "max" => @inputs["closed_max"] || @inputs["closedMax"],
            "name" => @inputs["closed_name"],
          }
        end
      min = number(hash["min"], "closed_ring.min")
      max = number(hash["max"], "closed_ring.max")
      raise invalid("closed_ring") if max < min

      {
        "name" => hash["name"].to_s.presence || "L0",
        "min" => min,
        "max" => max,
        "unit" => hash["unit"].to_s.presence || "mm",
      }
    end

    def normalize_rings
      raw = @inputs["component_rings"] || @inputs["componentRings"] || @inputs["rings"]
      raise invalid("component_rings") unless raw.respond_to?(:to_a)

      rings = raw.to_a.map.with_index { |ring, index| normalize_ring(ring, index) }
      raise invalid("component_rings") if rings.empty?

      rings
    end

    def normalize_ring(raw, index)
      hash = raw.respond_to?(:to_h) ? raw.to_h.transform_keys(&:to_s) : {}
      type = hash["type"].to_s
      type = "increasing" if %w[inc increasing +].include?(type)
      type = "decreasing" if %w[dec decreasing -].include?(type)
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
        "es" => es * factor,
        "ei" => ei * factor,
        "tolerance" => (es - ei) * factor,
        "mean_dev" => (es + ei) * factor / 2.0,
        "nominal" => size * factor,
      }
    end

    def deviations(hash, index)
      if present?(hash["es"]) || present?(hash["ei"])
        [
          number(hash["es"], "component_rings[#{index}].es"),
          number(hash["ei"], "component_rings[#{index}].ei"),
        ]
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

    def normalize_iterations
      raw = optional_number(@inputs["iterations"], "iterations") || DEFAULT_ITERATIONS
      iterations = raw.round
      raise invalid("iterations") if iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS

      iterations
    end

    def normalize_distribution
      distribution = (@inputs["distribution"] || "normal").to_s
      return distribution if DISTRIBUTION_K.key?(distribution)

      raise invalid("distribution")
    end

    def run_simulation(closed:, rings:, iterations:, distribution:, custom_k:, truncated:, rng:)
      nominal =
        rings.sum do |ring|
          sign = ring["type"] == "increasing" ? 1.0 : -1.0
          sign * (ring["nominal"] + ring["mean_dev"])
        end

      results = Array.new(iterations)
      pass_count = 0

      iterations.times do |i|
        value = nominal
        rings.each do |ring|
          sign = ring["type"] == "increasing" ? 1.0 : -1.0
          err =
            sample_tolerance_error(
              ring["tolerance"],
              distribution,
              custom_k,
              rng,
              es: ring["es"],
              ei: ring["ei"],
              truncated:,
            )
          value += sign * (err - ring["mean_dev"])
        end
        results[i] = value
        pass_count += 1 if value >= closed["min"] && value <= closed["max"]
      end

      mean = results.sum / iterations.to_f
      sum_sq = results.sum { |x| (x - mean)**2 }
      std_population = Math.sqrt(sum_sq / iterations.to_f)
      std = iterations > 1 ? Math.sqrt(sum_sq / (iterations - 1).to_f) : std_population
      sorted = results.sort

      {
        "nominal" => nominal,
        "mean" => mean,
        "std" => std,
        "std_population" => std_population,
        "min" => sorted.first,
        "max" => sorted.last,
        "pass_count" => pass_count,
        "pass_rate" => pass_count.to_f / iterations,
        "p05" => sorted[(iterations * 0.05).floor],
        "p50" => sorted[(iterations * 0.5).floor],
        "p95" => sorted[(iterations * 0.95).floor],
        "histogram" => build_histogram(sorted, closed),
      }
    end

    def sample_tolerance_error(tolerance, distribution, custom_k, rng, es:, ei:, truncated:)
      default_k = DISTRIBUTION_K[distribution] || 6.0
      k = custom_k.positive? ? custom_k : default_k
      spread = es - ei
      mean_dev = (es + ei) / 2.0
      spread_scale = default_k / k

      case distribution
      when "uniform", "rectangular"
        half = spread / 2.0
        mean_dev + (rng.call * 2.0 - 1.0) * half * spread_scale
      when "triangular"
        half = spread / 2.0
        u = rng.call + rng.call
        mean_dev + (u - 1.0) * half * spread_scale
      when "skewed"
        mean_dev + (rng.call**2 - 0.5) * spread * spread_scale
      else
        err = mean_dev + rand_normal(rng) * (spread / k)
        truncated ? clamp(err, ei, es) : err
      end
    end

    def run_sensitivity(closed:, rings:, iterations:, distribution:, custom_k:, truncated:, seed:)
      items =
        rings.each_with_index.map do |ring, index|
          isolated =
            rings.each_with_index.map do |other, j|
              if j == index
                other
              else
                other.merge(
                  "tolerance" => 0.0,
                  "es" => 0.0,
                  "ei" => 0.0,
                  "mean_dev" => 0.0,
                )
              end
            end
          sim =
            run_simulation(
              closed:,
              rings: isolated,
              iterations:,
              distribution:,
              custom_k:,
              truncated:,
              rng: seeded_random((seed + index) & 0xffffffff),
            )
          {
            "index" => index,
            "name" => ring["name"],
            "tolerance" => round(ring["tolerance"]),
            "factor" => ring["factor"],
            "type" => ring["type"],
            "mean" => round(sim["mean"]),
            "std" => round(sim["std"]),
            "spread" => round(sim["p95"] - sim["p05"]),
            "p05" => round(sim["p05"]),
            "p95" => round(sim["p95"]),
            "variance_share" => sim["std"]**2,
          }
        end

      total_var = items.sum { |item| item["variance_share"] }
      total_var = 1.0 if total_var <= 0
      ranked =
        items
          .map do |item|
            item.merge("variance_pct" => round(100.0 * item["variance_share"] / total_var))
          end
          .sort_by { |item| -item["spread"] }

      {
        "items" => ranked,
        "iterations" => iterations,
        "top_contributor" => ranked.first&.dig("name"),
      }
    end

    def stack_comparison(closed, rings)
      worst = worst_case_limits(rings, closed)
      rss = rss_limits(rings, closed)
      { "worst" => worst, "rss" => rss }
    end

    def worst_case_limits(rings, closed)
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
      limits(upper:, lower:, closed:)
    end

    def rss_limits(rings, closed)
      nominal =
        rings.sum do |ring|
          sign = ring["type"] == "increasing" ? 1.0 : -1.0
          sign * (ring["nominal"] + ring["mean_dev"])
        end
      tolerance = Math.sqrt(rings.sum { |ring| ring["tolerance"]**2 })
      limits(upper: nominal + tolerance / 2.0, lower: nominal - tolerance / 2.0, closed:)
    end

    def limits(upper:, lower:, closed:)
      {
        "nominal" => round((upper + lower) / 2.0),
        "upper" => round(upper),
        "lower" => round(lower),
        "total_tolerance" => round(upper - lower),
        "pass" => lower >= closed["min"] && upper <= closed["max"],
      }
    end

    def build_histogram(sorted, closed)
      return [] if sorted.empty?

      lo = [sorted.first, closed["min"]].min
      hi = [sorted.last, closed["max"]].max
      span = hi - lo
      span = 1e-9 if span <= 0
      bin_width = span / HISTOGRAM_BINS.to_f
      counts = Array.new(HISTOGRAM_BINS, 0)

      sorted.each do |value|
        index = ((value - lo) / bin_width).floor
        index = HISTOGRAM_BINS - 1 if index >= HISTOGRAM_BINS
        index = 0 if index.negative?
        counts[index] += 1
      end

      counts.each_with_index.map do |count, index|
        {
          "x0" => round(lo + index * bin_width),
          "x1" => round(lo + (index + 1) * bin_width),
          "count" => count,
        }
      end
    end

    def seeded_random(seed)
      state = seed & 0xffffffff
      lambda do
        state = (state * 1_664_525 + 1_013_904_223) & 0xffffffff
        state.to_f / 4_294_967_296.0
      end
    end

    def rand_normal(rng)
      u = 0.0
      v = 0.0
      u = rng.call while u.zero?
      v = rng.call while v.zero?
      Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math::PI * v)
    end

    def clamp(value, lo, hi)
      [[value, lo].max, hi].min
    end

    def truthy?(raw, default:)
      return default if raw.nil? || raw == ""
      return raw if raw == true || raw == false

      %w[1 true yes on].include?(raw.to_s.downcase)
    end

    def present?(value)
      !(value.nil? || value == "")
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
      (value.to_f * 1_000_000).round / 1_000_000.0
    end
  end
end
