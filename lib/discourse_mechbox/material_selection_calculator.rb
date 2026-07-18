# frozen_string_literal: true

module DiscourseMechbox
  # Multi-objective material ranking ported from MechBox/src/utils/material-selection-calc.js.
  class MaterialSelectionCalculator
    class Error < StandardError
    end

    # Category keys match MechBox Chinese category labels in materials.json.
    COST_INDEX = {
      "碳素钢" => 1.0,
      "低合金钢" => 1.2,
      "合金钢" => 1.5,
      "模具钢" => 2.0,
      "不锈钢" => 2.2,
      "铝合金" => 2.0,
      "铸铁" => 0.8,
      "铜合金" => 2.5,
      "钛合金" => 8.0,
      "高温合金" => 6.0,
      "非金属" => 2.0,
    }.freeze

    WELDABILITY = {
      "碳素钢" => 4,
      "低合金钢" => 4,
      "合金钢" => 3,
      "模具钢" => 3,
      "不锈钢" => 3,
      "铝合金" => 2,
      "铸铁" => 1,
      "铜合金" => 3,
      "钛合金" => 2,
      "高温合金" => 2,
      "非金属" => 3,
    }.freeze

    MACHINABILITY = {
      "碳素钢" => 4,
      "低合金钢" => 3,
      "合金钢" => 3,
      "模具钢" => 3,
      "不锈钢" => 2,
      "铝合金" => 5,
      "铸铁" => 4,
      "铜合金" => 5,
      "钛合金" => 1,
      "高温合金" => 2,
      "非金属" => 3,
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      temp_c = optional_number("temp_c", aliases: %w[tempC]) || 20.0
      min_sigma = optional_number("min_sigma_allow_mpa", aliases: %w[minSigmaAllow]) || 0.0
      max_density = optional_number("max_density", aliases: %w[maxDensity]) || Float::INFINITY
      min_weld = optional_number("min_weldability", aliases: %w[minWeldability]) || 0.0
      max_cost = optional_number("max_cost_index", aliases: %w[maxCostIndex]) || Float::INFINITY

      weights = normalize_weights(
        strength: optional_number("weight_strength", aliases: %w[strength]) || 0.35,
        weight: optional_number("weight_light", aliases: %w[weight]) || 0.2,
        cost: optional_number("weight_cost", aliases: %w[cost]) || 0.2,
        weldability: optional_number("weight_weldability", aliases: %w[weldability]) || 0.15,
        machinability: optional_number("weight_machinability", aliases: %w[machinability]) || 0.1,
      )

      materials = MaterialsLibrary.all
      max_sigma =
        materials.map { |m| MaterialsLibrary.allowable_at_temp(m, temp_c)["sigma_allow_mpa"] }.max.to_f
      min_density = materials.map { |m| m["density"].to_f }.min
      max_cost_ref = COST_INDEX.values.max

      scored =
        materials.map do |m|
          allow = MaterialsLibrary.allowable_at_temp(m, temp_c)
          props = props_for(m["category"])
          hard =
            allow["sigma_allow_mpa"] >= min_sigma && m["density"].to_f <= max_density &&
              props[:weldability] >= min_weld && props[:cost_index] <= max_cost

          strength_score = clamp01(allow["sigma_allow_mpa"] / [max_sigma, 1.0].max)
          weight_score = clamp01(min_density / [m["density"].to_f, 1e-9].max)
          cost_score = clamp01(1.0 - props[:cost_index] / max_cost_ref)
          weld_score = clamp01(props[:weldability] / 5.0)
          mach_score = clamp01(props[:machinability] / 5.0)

          total =
            weights[:strength] * strength_score + weights[:weight] * weight_score +
              weights[:cost] * cost_score + weights[:weldability] * weld_score +
              weights[:machinability] * mach_score

          {
            "id" => m["id"],
            "name" => m["name"],
            "category" => m["category"],
            "sigma_allow_mpa" => allow["sigma_allow_mpa"],
            "density" => m["density"],
            "cost_index" => props[:cost_index],
            "weldability" => props[:weldability],
            "machinability" => props[:machinability],
            "hard_filter" => hard,
            "scores" => {
              "strength" => round(strength_score, 4),
              "weight" => round(weight_score, 4),
              "cost" => round(cost_score, 4),
              "weldability" => round(weld_score, 4),
              "machinability" => round(mach_score, 4),
            },
            "total_score" => hard ? round(total * 100.0, 4) : 0.0,
          }
        end

      filtered = scored.select { |s| s["hard_filter"] }.sort_by { |s| -s["total_score"] }
      filtered.each_with_index { |s, i| s["rank"] = i + 1 }

      recommendations = calc_mode == "simple" ? filtered.first(5) : filtered
      result = {
        "calc_mode" => calc_mode,
        "recommendations" => recommendations,
        "top_pick" => filtered.first,
        "weights" => weights.transform_keys(&:to_s),
        "requirements" => {
          "min_sigma_allow_mpa" => min_sigma,
          "max_density" => max_density.finite? ? max_density : nil,
          "temp_c" => temp_c,
          "min_weldability" => min_weld,
          "max_cost_index" => max_cost.finite? ? max_cost : nil,
        },
        "filtered_count" => filtered.size,
        "total_count" => materials.size,
        "show_score_breakdown" => calc_mode != "simple",
      }

      if calc_mode == "professional"
        result["best_strength"] = filtered.max_by { |s| s["sigma_allow_mpa"] }
        result["best_weight"] = filtered.min_by { |s| s["density"].to_f }
        result["best_cost"] = filtered.min_by { |s| s["cost_index"] }
        result["tradeoff_note_key"] =
          result["best_strength"] && result["top_pick"] &&
            result["best_strength"]["id"] != result["top_pick"]["id"] ?
              "mismatch" :
              "match"
      end

      result
    end

    private

    def props_for(category)
      {
        cost_index: COST_INDEX[category] || 2.0,
        weldability: WELDABILITY[category] || 3,
        machinability: MACHINABILITY[category] || 3,
      }
    end

    def normalize_weights(hash)
      sum = hash.values.sum
      sum = 1.0 if sum <= 0
      hash.transform_values { |v| v / sum }
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def clamp01(x)
      [[x, 0.0].max, 1.0].min
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
