# frozen_string_literal: true

module DiscourseMechbox
  # Batch tolerance verification ported from MechBox batch-analysis.js.
  # Each row is a tolerance list (optional factors). Default pass_mode is
  # "budget" (stacked T within [min,max]); "band" matches MechBox ±T/2 checks.
  class BatchAnalysisCalculator
    class Error < StandardError
    end

    MAX_ROWS = 50

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      target_min = number(@inputs["target_min"] || @inputs["targetMin"] || closed_value("min"), "target_min")
      target_max = number(@inputs["target_max"] || @inputs["targetMax"] || closed_value("max"), "target_max")
      raise invalid("target_range") if target_max < target_min

      pass_mode = normalize_pass_mode
      rows = normalize_rows
      results = rows.each_with_index.map { |row, index| analyze_row(row, index, target_min, target_max, pass_mode) }

      valid = results.reject { |row| row["error_key"] }
      summary = {
        "total" => results.length,
        "valid" => valid.length,
        "rss_pass" => valid.count { |row| row["rss_pass"] },
        "worst_pass" => valid.count { |row| row["worst_pass"] },
        "fail" => valid.count { |row| !row["rss_pass"] && !row["worst_pass"] },
        "critical_gap" => valid.count { |row| row["advice_level"] == "critical" },
        "errors" => results.count { |row| row["error_key"] },
      }

      {
        "target_min" => target_min,
        "target_max" => target_max,
        "pass_mode" => pass_mode,
        "summary" => summary,
        "results" => results,
      }
    end

    private

    def closed_value(key)
      raw = @inputs["closed_ring"] || @inputs["closedRing"]
      return nil unless raw.respond_to?(:to_h)

      raw.to_h.transform_keys(&:to_s)[key]
    end

    def normalize_pass_mode
      mode = (@inputs["pass_mode"] || @inputs["passMode"] || "budget").to_s
      return mode if %w[budget band].include?(mode)

      raise invalid("pass_mode")
    end

    def normalize_rows
      if present?(@inputs["csv"]) || present?(@inputs["csv_text"]) || present?(@inputs["csvText"])
        rows = parse_batch_csv(@inputs["csv"] || @inputs["csv_text"] || @inputs["csvText"])
      else
        raw = @inputs["rows"] || @inputs["schemes"]
        raise invalid("rows") unless raw.respond_to?(:to_a)

        rows = raw.to_a.map.with_index { |row, index| normalize_row(row, index) }
      end

      raise invalid("rows") if rows.empty?
      raise invalid("rows") if rows.length > MAX_ROWS

      rows
    end

    def normalize_row(raw, index)
      hash = raw.respond_to?(:to_h) ? raw.to_h.transform_keys(&:to_s) : {}
      tolerances =
        if hash["tolerances"].is_a?(Array)
          hash["tolerances"].map.with_index { |value, i| number(value, "rows[#{index}].tolerances[#{i}]") }
        else
          parse_tolerance_list(hash["tolerances"] || hash["tolerance_list"], "rows[#{index}].tolerances")
        end
      factors =
        if hash["factors"].is_a?(Array)
          hash["factors"].map.with_index { |value, i| number(value, "rows[#{index}].factors[#{i}]") }
        elsif present?(hash["factors"])
          parse_tolerance_list(hash["factors"], "rows[#{index}].factors")
        else
          []
        end

      {
        "name" => hash["name"].to_s.presence || "方案 #{index + 1}",
        "tolerances" => tolerances,
        "factors" => factors,
      }
    end

    def parse_batch_csv(text)
      String(text)
        .to_s
        .strip
        .split(/\r?\n/)
        .map(&:strip)
        .reject(&:empty?)
        .filter_map
        .with_index do |line, index|
          parts = line.split(/[,，\t]/).map(&:strip)
          next if parts.length < 2

          {
            "name" => parts[0].presence || "行 #{index + 1}",
            "tolerances" => parts[1..].map { |value| Float(value) },
            "factors" => [],
          }
        end
    rescue ArgumentError, TypeError
      raise invalid("csv")
    end

    def parse_tolerance_list(raw, field)
      return [] if raw.nil? || raw == ""

      String(raw)
        .split(/[,，\s]+/)
        .reject(&:empty?)
        .map { |value| Float(value) }
        .each { |value| raise invalid(field) if value.negative? }
    rescue ArgumentError, TypeError
      raise invalid(field)
    end

    def analyze_row(row, index, target_min, target_max, pass_mode)
      tolerances = row["tolerances"]
      if tolerances.blank?
        return {
          "index" => index,
          "name" => row["name"],
          "error_key" => "batch_no_tolerance",
        }
      end

      factors = row["factors"]
      analyzed = analyze_tolerance_row(tolerances, factors)
      rss_pass = pass?(analyzed["rss_lower"], analyzed["rss_upper"], analyzed["rss_tolerance"], target_min, target_max, pass_mode)
      worst_pass =
        pass?(
          analyzed["worst_lower"],
          analyzed["worst_upper"],
          analyzed["worst_tolerance"],
          target_min,
          target_max,
          pass_mode,
        )
      advice = combine_stack_advice(worst_pass, rss_pass, analyzed["worst_tolerance"], analyzed["rss_tolerance"])

      {
        "index" => index,
        "name" => row["name"],
        "ring_count" => analyzed["ring_count"],
        "tolerances" => tolerances.map { |value| round(value) },
        "worst_tolerance" => round(analyzed["worst_tolerance"]),
        "rss_tolerance" => round(analyzed["rss_tolerance"]),
        "worst_upper" => round(analyzed["worst_upper"]),
        "worst_lower" => round(analyzed["worst_lower"]),
        "rss_upper" => round(analyzed["rss_upper"]),
        "rss_lower" => round(analyzed["rss_lower"]),
        "rss_pass" => rss_pass,
        "worst_pass" => worst_pass,
        "pass" => rss_pass && worst_pass,
        "advice_level" => advice["level"],
        "advice_key" => advice["warning_key"],
        "method_ratio" => advice["method_ratio"] && round(advice["method_ratio"]),
      }
    end

    def analyze_tolerance_row(tolerances, factors)
      rings =
        tolerances.each_with_index.map do |tolerance, index|
          factor = factors[index] || 1.0
          raise invalid("factors") if factor <= 0

          scaled = tolerance * factor
          {
            "tolerance" => scaled,
            "es" => scaled / 2.0,
            "ei" => -scaled / 2.0,
          }
        end

      worst_tolerance = rings.sum { |ring| ring["tolerance"] }
      worst_upper = rings.sum { |ring| ring["es"] }
      worst_lower = rings.sum { |ring| ring["ei"] }
      rss_tolerance = Math.sqrt(rings.sum { |ring| ring["tolerance"]**2 })

      {
        "ring_count" => rings.length,
        "worst_tolerance" => worst_tolerance,
        "rss_tolerance" => rss_tolerance,
        "worst_upper" => worst_upper,
        "worst_lower" => worst_lower,
        "rss_upper" => rss_tolerance / 2.0,
        "rss_lower" => -rss_tolerance / 2.0,
      }
    end

    def pass?(lower, upper, total_tolerance, target_min, target_max, pass_mode)
      if pass_mode == "budget"
        total_tolerance >= target_min && total_tolerance <= target_max
      else
        lower >= target_min && upper <= target_max
      end
    end

    def combine_stack_advice(worst_pass, rss_pass, worst_tolerance, rss_tolerance)
      gap =
        if rss_pass && !worst_pass
          { "level" => "critical", "warning_key" => "rss_pass_worst_fail" }
        elsif !rss_pass && worst_pass
          { "level" => "info", "warning_key" => "worst_pass_rss_fail" }
        else
          { "level" => "none", "warning_key" => nil }
        end

      divergence =
        if rss_tolerance <= 0
          { "level" => "none", "ratio" => nil, "warning_key" => nil }
        else
          ratio = worst_tolerance / rss_tolerance
          if ratio >= 2
            { "level" => "warn", "ratio" => ratio, "warning_key" => "stack_method_warn" }
          elsif ratio >= 1.5
            { "level" => "caution", "ratio" => ratio, "warning_key" => "stack_method_caution" }
          else
            { "level" => "none", "ratio" => ratio, "warning_key" => nil }
          end
        end

      level =
        if gap["level"] == "critical"
          "critical"
        elsif divergence["level"] == "warn"
          "warn"
        elsif gap["level"] != "none"
          gap["level"]
        else
          divergence["level"]
        end

      {
        "level" => level,
        "warning_key" => gap["warning_key"] || divergence["warning_key"],
        "method_ratio" => divergence["ratio"],
      }
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
