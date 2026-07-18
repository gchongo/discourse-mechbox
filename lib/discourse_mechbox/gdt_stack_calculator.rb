# frozen_string_literal: true

module DiscourseMechbox
  # GD&T tolerance stack ported from MechBox gdt-chain.js + gdt-stack-calc.js.
  # Supports position (2D), radial, and form-linear/form-direct stacks with
  # optional datum accumulation and MMC/LMC bonus.
  class GdtStackCalculator
    class Error < StandardError
    end

    STACK_MODES = {
      "position" => { "stack" => "2d-position", "label" => "位置度链" },
      "coaxiality" => { "stack" => "radial", "label" => "同轴度链" },
      "runout" => { "stack" => "radial", "label" => "跳动链" },
      "roundness" => { "stack" => "radial", "label" => "圆度链" },
      "flatness" => { "stack" => "form-direct", "label" => "平面度链" },
      "straightness" => { "stack" => "form-direct", "label" => "直线度链" },
      "parallelism" => { "stack" => "form-linear", "label" => "平行度链" },
      "perpendicularity" => { "stack" => "form-linear", "label" => "垂直度链" },
      "profile-2d" => { "stack" => "form-linear", "label" => "2D 轮廓度链" },
      "profile-gdt" => { "stack" => "form-linear", "label" => "GD&T 轮廓度链" },
    }.freeze

    DATUM_WEIGHT = {
      "primary" => 1.0,
      "secondary" => 0.7,
      "tertiary" => 0.5,
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      type_id = (@inputs["type_id"] || @inputs["typeId"] || "position").to_s
      mode = STACK_MODES[type_id]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "type_id") if mode.nil?

      method = normalize_method(@inputs["method"])
      closed = normalize_closed_ring
      rings = normalize_rings
      datums = normalize_datums
      modifier = normalize_modifier
      auto_bonus = truthy?(@inputs["auto_bonus"] || @inputs["autoBonus"], default: true)

      chain = calculate_chain(mode, closed, rings, method)
      bonus = resolve_bonus(rings, modifier, auto_bonus)
      chain = apply_modifier(chain, closed, modifier, bonus)

      contributions = calc_contributions(rings, method, mode["stack"])
      datum_stack = datums.empty? ? nil : calc_datum_accumulation(datums)

      effective_with_datum = chain["total_tolerance"]
      pass_with_datum = chain["pass"]
      if datum_stack
        effective_with_datum =
          Math.sqrt(chain["total_tolerance"].to_f**2 + datum_stack["total"].to_f**2)
        pass_with_datum =
          if chain["pass_mode"] == "budget"
            effective_with_datum >= closed["min"] && effective_with_datum <= closed["max"]
          else
            chain["nominal"] + effective_with_datum / 2.0 <= closed["max"] &&
              chain["nominal"] - effective_with_datum / 2.0 >= closed["min"]
          end
      end

      worst = calculate_chain(mode, closed, rings, "worst")
      worst = apply_modifier(worst, closed, modifier, bonus)
      # Budget margin = allowable zone − predicted stack (not closed.max − expanded budget).
      worst_margin =
        if worst["pass_mode"] == "budget"
          allowance = worst["bonus_applied"].to_f
          closed["max"] + allowance - worst["total_tolerance"].to_f
        else
          [
            closed["max"] - worst["upper"].to_f,
            worst["lower"].to_f - closed["min"],
          ].min
        end

      pass = chain["pass"]
      pass &&= pass_with_datum if datum_stack
      pass &&= worst_margin >= 0

      warnings = []
      warnings << "outside_budget" unless chain["pass"]
      warnings << "datum_fail" if datum_stack && !pass_with_datum
      warnings << "worst_fail" if worst_margin < 0

      {
        "type_id" => type_id,
        "mode" => mode,
        "method" => method,
        "closed_ring" => closed,
        "chain" => chain,
        "pass" => pass,
        "modifier" => {
          "type" => modifier,
          "bonus" => round(bonus["bonus"]),
          "source" => bonus["source"],
          "breakdown" => bonus["items"],
          "effective" => round(chain["effective_tolerance"] || chain["total_tolerance"]),
        },
        "contributions" => contributions,
        "datum_stack" => datum_stack,
        "effective_with_datum" => round(effective_with_datum),
        "pass_with_datum" => pass_with_datum,
        "top_contributor" => contributions.first&.dig("name"),
        "worst_case" => worst,
        "worst_case_margin" => round(worst_margin),
        "warnings" => warnings,
      }
    end

    private

    def normalize_method(raw)
      method = raw.to_s.presence || "rss"
      return method if %w[rss worst].include?(method)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "method")
    end

    def normalize_modifier
      mod = (@inputs["tolerance_modifier"] || @inputs["toleranceModifier"] || "RFS").to_s.upcase
      return mod if %w[RFS MMC LMC].include?(mod)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "tolerance_modifier")
    end

    def normalize_closed_ring
      raw = @inputs["closed_ring"] || @inputs["closedRing"]
      hash =
        if raw.respond_to?(:to_h)
          raw.to_h.transform_keys(&:to_s)
        else
          {
            "min" => @inputs["closed_min"] || @inputs["closedMin"] || 0,
            "max" => @inputs["closed_max"] || @inputs["closedMax"],
          }
        end
      min = number(hash["min"] || 0, "closed_ring.min")
      max = number(hash["max"], "closed_ring.max")
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "closed_ring") if max < min

      { "min" => min, "max" => max, "unit" => hash["unit"].to_s.presence || "mm" }
    end

    def normalize_rings
      raw = @inputs["rings"] || @inputs["component_rings"] || @inputs["componentRings"]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rings") unless raw.respond_to?(:to_a)

      rings = raw.to_a.map.with_index { |ring, index| normalize_ring(ring, index) }
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rings") if rings.empty?

      rings
    end

    def normalize_ring(raw, index)
      hash = raw.respond_to?(:to_h) ? raw.to_h.transform_keys(&:to_s) : {}
      type = hash["type"].to_s.presence || "increasing"
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rings[#{index}].type") unless %w[
        increasing
        decreasing
      ].include?(type)

      factor = optional_number(hash["factor"], "rings[#{index}].factor") || 1.0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rings[#{index}].factor") if factor <= 0

      tolerance = number(hash["tolerance"], "rings[#{index}].tolerance")
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "rings[#{index}].tolerance") if tolerance < 0

      feature_kind = hash["feature_kind"] || hash["featureKind"]
      feature_kind = feature_kind.to_s.presence
      size_tol =
        optional_number(
          hash["size_tolerance"] || hash["sizeTolerance"],
          "rings[#{index}].size_tolerance",
        )

      {
        "name" => hash["name"].to_s.presence || "环 #{index + 1}",
        "type" => type,
        "factor" => factor,
        "tolerance" => tolerance,
        "direction" => hash["direction"].to_s.presence,
        "feature_kind" => feature_kind,
        "size_tolerance" => size_tol,
        "size" => optional_number(hash["size"], "rings[#{index}].size") || 0.0,
      }
    end

    def normalize_datums
      raw = @inputs["datums"]
      return [] if raw.nil? || raw == ""
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "datums") unless raw.respond_to?(:to_a)

      raw.to_a.map.with_index do |datum, index|
        hash = datum.respond_to?(:to_h) ? datum.to_h.transform_keys(&:to_s) : {}
        priority = (hash["priority"] || "primary").to_s
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "datums[#{index}].priority") unless DATUM_WEIGHT.key?(
          priority,
        )

        tolerance = number(hash["tolerance"], "datums[#{index}].tolerance")
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "datums[#{index}].tolerance") if tolerance < 0

        {
          "label" => (hash["label"] || hash["name"]).to_s.presence || "基准 #{index + 1}",
          "priority" => priority,
          "tolerance" => tolerance,
        }
      end
    end

    def calculate_chain(mode, closed, rings, method)
      case mode["stack"]
      when "2d-position"
        total = calc_2d_position_tolerance(rings, method)
        evaluate_pass(total, closed, pass_mode: "budget", mode_label: mode["label"])
      when "radial"
        mapped = rings.map { |r| r["tolerance"] * r["factor"] }
        total = aggregate(mapped, method)
        nominal = signed_nominal(rings)
        evaluate_pass(total, closed, pass_mode: "band", nominal: nominal, mode_label: mode["label"])
      else
        mapped = rings.map { |r| r["tolerance"] * r["factor"] }
        total = aggregate(mapped, method)
        nominal = signed_nominal(rings)
        # form stacks with size≈0 use budget when closed.min>=0
        mode_pass =
          if closed["min"] >= 0 && nominal.abs < 1e-9
            "budget"
          else
            "band"
          end
        evaluate_pass(total, closed, pass_mode: mode_pass, nominal: nominal, mode_label: mode["label"])
      end
    end

    def calc_2d_position_tolerance(rings, method)
      x = []
      y = []
      other = []
      rings.each do |ring|
        dir = ring["direction"]
        if dir.nil? || dir == ""
          other << ring
        elsif %w[left right].include?(dir)
          x << ring
        elsif %w[up down].include?(dir)
          y << ring
        else
          other << ring
        end
      end
      tol_x = aggregate((x + other).map { |r| r["tolerance"] * r["factor"] }, method)
      tol_y = aggregate(y.map { |r| r["tolerance"] * r["factor"] }, method)
      return tol_x + tol_y if method == "worst"

      2.0 * Math.sqrt((tol_x / 2.0)**2 + (tol_y / 2.0)**2)
    end

    def aggregate(values, method)
      return 0.0 if values.empty?
      return values.sum if method == "worst"

      Math.sqrt(values.sum { |v| v**2 })
    end

    def signed_nominal(rings)
      rings.sum do |ring|
        sign = ring["type"] == "increasing" ? 1.0 : -1.0
        sign * ring["size"].to_f * ring["factor"]
      end
    end

    def evaluate_pass(total_tolerance, closed, pass_mode:, nominal: 0.0, mode_label: nil)
      if pass_mode == "budget"
        pass = total_tolerance >= closed["min"] && total_tolerance <= closed["max"]
        {
          "nominal" => 0.0,
          "upper" => round(total_tolerance),
          "lower" => closed["min"],
          "total_tolerance" => round(total_tolerance),
          "pass" => pass,
          "pass_mode" => "budget",
          "mode_label" => mode_label,
        }
      else
        upper = nominal + total_tolerance / 2.0
        lower = nominal - total_tolerance / 2.0
        pass = lower >= closed["min"] && upper <= closed["max"]
        {
          "nominal" => round(nominal),
          "upper" => round(upper),
          "lower" => round(lower),
          "total_tolerance" => round(total_tolerance),
          "pass" => pass,
          "pass_mode" => "band",
          "mode_label" => mode_label,
        }
      end
    end

    def resolve_bonus(rings, modifier, auto_bonus)
      return { "bonus" => 0.0, "source" => "none", "items" => [] } if modifier == "RFS"

      manual =
        optional_number(
          @inputs["bonus_tolerance"] || @inputs["bonusTolerance"],
          "bonus_tolerance",
        ) || 0.0

      unless auto_bonus
        return { "bonus" => manual, "source" => "manual", "items" => [] }
      end

      items = []
      rings.each do |ring|
        next unless %w[hole shaft fos].include?(ring["feature_kind"].to_s)

        t_size = ring["size_tolerance"].to_f.abs
        next if t_size <= 0

        items << {
          "name" => ring["name"],
          "feature_kind" => ring["feature_kind"],
          "size_tolerance" => round(t_size),
          "bonus" => round(t_size),
        }
      end
      total = items.sum { |i| i["bonus"] }
      return { "bonus" => total, "source" => "auto", "items" => items } if total > 0
      return { "bonus" => manual, "source" => "manual", "items" => [] } if manual > 0

      { "bonus" => 0.0, "source" => "auto", "items" => [] }
    end

    def apply_modifier(result, closed, modifier, bonus_info)
      bonus = bonus_info["bonus"].to_f
      allowance =
        case modifier
        when "MMC" then bonus
        when "LMC" then bonus * 0.5
        else 0.0
        end

      if allowance <= 0 || modifier == "RFS"
        return result.merge(
          "bonus_applied" => 0.0,
          "bonus_source" => bonus_info["source"],
          "effective_tolerance" => result["total_tolerance"],
        )
      end

      if result["pass_mode"] == "budget"
        expanded = evaluate_pass(
          result["total_tolerance"],
          { "min" => closed["min"], "max" => closed["max"] + allowance },
          pass_mode: "budget",
          mode_label: result["mode_label"],
        )
        expanded.merge(
          "bonus_applied" => round(allowance),
          "bonus_source" => bonus_info["source"],
          "effective_tolerance" => round(closed["max"] + allowance),
          "total_tolerance" => result["total_tolerance"],
        )
      else
        pass =
          result["lower"].to_f >= closed["min"] - allowance / 2.0 &&
            result["upper"].to_f <= closed["max"] + allowance / 2.0
        result.merge(
          "pass" => pass,
          "bonus_applied" => round(allowance),
          "bonus_source" => bonus_info["source"],
          "effective_tolerance" => round(result["total_tolerance"].to_f + allowance),
        )
      end
    end

    def calc_contributions(rings, method, stack)
      if stack == "2d-position" && method != "worst"
        x = rings.select { |r| %w[left right].include?(r["direction"]) }
        y = rings.select { |r| %w[up down].include?(r["direction"]) }
        other = rings.reject { |r| %w[left right up down].include?(r["direction"].to_s) }
        return (
          axis_contributions(x + other, method, "X") + axis_contributions(y, method, "Y")
        ).sort_by { |c| -c["percent"] }
      end

      mapped =
        rings.map do |r|
          {
            "name" => r["name"],
            "tolerance" => r["tolerance"] * r["factor"],
          }
        end

      if method == "worst"
        total = mapped.sum { |r| r["tolerance"] }
        return mapped.map { |r|
          {
            "name" => r["name"],
            "tolerance" => round(r["tolerance"]),
            "percent" => round(total.zero? ? 0.0 : r["tolerance"] / total * 100.0),
          }
        }
      end

      squares = mapped.map { |r| r["tolerance"]**2 }
      sum_sq = squares.sum
      mapped.each_with_index.map do |r, i|
        {
          "name" => r["name"],
          "tolerance" => round(r["tolerance"]),
          "percent" => round(sum_sq.zero? ? 0.0 : squares[i] / sum_sq * 100.0),
        }
      end
    end

    def axis_contributions(rings, method, axis)
      mapped =
        rings.map do |r|
          {
            "name" => "#{r["name"]} (#{axis})",
            "tolerance" => r["tolerance"] * r["factor"],
          }
        end
      return [] if mapped.empty?

      if method == "worst"
        total = mapped.sum { |r| r["tolerance"] }
        return mapped.map { |r|
          {
            "name" => r["name"],
            "tolerance" => round(r["tolerance"]),
            "percent" => round(total.zero? ? 0.0 : r["tolerance"] / total * 50.0),
          }
        }
      end

      squares = mapped.map { |r| r["tolerance"]**2 }
      sum_sq = squares.sum
      mapped.each_with_index.map do |r, i|
        {
          "name" => r["name"],
          "tolerance" => round(r["tolerance"]),
          "percent" => round(sum_sq.zero? ? 0.0 : squares[i] / sum_sq * 50.0),
        }
      end
    end

    def calc_datum_accumulation(datums)
      items =
        datums.map do |d|
          weight = DATUM_WEIGHT[d["priority"]]
          {
            "label" => d["label"],
            "priority" => d["priority"],
            "tolerance" => round(d["tolerance"]),
            "weighted" => round(d["tolerance"] * weight),
          }
        end
      total = Math.sqrt(items.sum { |i| i["weighted"]**2 })
      {
        "total" => round(total),
        "items" => items,
        "formula" => "T_datum = √Σ(wᵢ Tᵢ)²",
      }
    end

    def truthy?(raw, default:)
      return default if raw.nil? || raw == ""
      return raw if raw == true || raw == false

      %w[1 true yes on].include?(raw.to_s.downcase)
    end

    def optional_number(value, field)
      return nil if value.nil? || value == ""

      Float(value)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: field)
    end

    def number(value, field)
      optional_number(value, field) || raise(Error, I18n.t("mechbox.errors.invalid_input", field: field))
    end

    def round(value)
      (value.to_f * 1_000_000).round / 1_000_000.0
    end
  end
end
