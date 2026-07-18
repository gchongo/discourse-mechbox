# frozen_string_literal: true

require "json"

module DiscourseMechbox
  # Sheet-metal flat pattern estimate ported from MechBox/src/utils/sheet-metal-calc.js.
  # Units: all lengths mm, bend angle degrees. K-factor must stay in [0, 0.5].
  class SheetMetalCalculator
    class Error < StandardError
    end

    METHODS = %w[k_factor bend_deduction].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      method = (@inputs["method"] || "k_factor").to_s
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "method") unless METHODS.include?(method)

      thickness = positive_number("thickness_mm", aliases: %w[thickness])
      default_radius = optional_non_negative_number("bend_radius_mm", aliases: %w[bendRadius bend_radius]) || thickness
      default_k = optional_number("k_factor", aliases: %w[kFactor]) || 0.33
      validate_k_factor(default_k, "k_factor")
      segments = parse_segments
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments_json") if segments.empty?

      flat_length = 0.0
      details = []
      bend_count = 0

      segments.each_with_index do |segment, index|
        type = segment["type"].to_s
        case type
        when "straight"
          length = segment_number(segment, "length", default: 0.0)
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments[#{index}].length") if length.negative?

          flat_length += length
          details << { "index" => index, "type" => type, "length_mm" => round(length, 6), "contribution_mm" => round(length, 6) }
        when "bend"
          bend_count += 1
          angle = segment_number(segment, "angle", default: 90.0)
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments[#{index}].angle") if angle <= 0.0 || angle >= 180.0

          radius = segment_number(segment, "radius", default: default_radius)
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments[#{index}].radius") if radius.negative?

          k_factor = segment_number(segment, "kFactor", default: nil)
          k_factor = segment_number(segment, "k_factor", default: default_k) if k_factor.nil?
          validate_k_factor(k_factor, "segments[#{index}].k_factor")

          allowance = bend_allowance(angle, radius, thickness, k_factor)
          deduction = bend_deduction(angle, radius, thickness, k_factor)
          if method == "bend_deduction"
            details << {
              "index" => index,
              "type" => type,
              "angle_deg" => angle,
              "radius_mm" => radius,
              "k_factor" => k_factor,
              "bend_deduction_mm" => round(deduction, 6),
              "contribution_mm" => round(-deduction, 6),
            }
          else
            flat_length += allowance
            details << {
              "index" => index,
              "type" => type,
              "angle_deg" => angle,
              "radius_mm" => radius,
              "k_factor" => k_factor,
              "bend_allowance_mm" => round(allowance, 6),
              "bend_deduction_mm" => round(deduction, 6),
              "contribution_mm" => round(allowance, 6),
            }
          end
        else
          raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments[#{index}].type")
        end
      end

      result = if method == "bend_deduction"
        outer_sum = optional_non_negative_number("outer_sum_mm", aliases: %w[outerSum outer_sum]) || flat_length
        total_deduction = details.sum { |detail| detail["bend_deduction_mm"].to_f }
        {
          "calc_mode" => calc_mode,
          "method" => method,
          "thickness_mm" => thickness,
          "outer_sum_mm" => round(outer_sum, 6),
          "total_deduction_mm" => round(total_deduction, 6),
          "flat_length_mm" => round(outer_sum - total_deduction, 6),
          "bend_count" => bend_count,
          "details" => details,
        }
      else
        {
          "calc_mode" => calc_mode,
          "method" => method,
          "thickness_mm" => thickness,
          "bend_radius_mm" => default_radius,
          "k_factor" => default_k,
          "flat_length_mm" => round(flat_length, 6),
          "bend_count" => bend_count,
          "details" => details,
        }
      end

      if calc_mode == "simple"
        result["estimate_only"] = true
        result["pass"] = false
      else
        straight_lengths = details.select { |detail| detail["type"] == "straight" }.map { |detail| detail["length_mm"].to_f }
        min_flange = thickness * 4.0
        min_straight = straight_lengths.empty? ? 0.0 : straight_lengths.min
        result.merge!(
          "min_flange_rule_mm" => round(min_flange, 6),
          "min_straight_length_mm" => round(min_straight, 6),
          "flange_pass" => bend_count.zero? || min_straight >= min_flange,
        )
        result["pass"] = result["flange_pass"]
      end

      if calc_mode == "professional"
        springback = optional_non_negative_number("springback_deg", aliases: %w[springbackFactor springback]) || 0.5
        result["springback_deg"] = springback
        result["springback_estimate_only"] = true
        result["compensated_flat_length_mm"] = round(result["flat_length_mm"] * (1.0 + springback / (90.0 * [bend_count, 1].max)), 6)
        result["min_inner_radius_mm"] = thickness
        result["radius_pass"] = default_radius >= thickness
        result["pass"] = result["pass"] && result["radius_pass"]
      end

      result
    end

    private

    def bend_allowance(angle_deg, radius, thickness, k_factor)
      Math::PI / 180.0 * angle_deg * (radius + k_factor * thickness)
    end

    def bend_deduction(angle_deg, radius, thickness, k_factor)
      rad = angle_deg * Math::PI / 180.0
      outside_setback = 2.0 * (radius + thickness) * Math.tan(rad / 2.0)
      outside_setback - bend_allowance(angle_deg, radius, thickness, k_factor)
    end

    def parse_segments
      raw = @inputs["segments"] || @inputs["segments_json"] || @inputs["segmentsJson"]
      parsed = raw.is_a?(Array) ? raw : JSON.parse(raw.to_s)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments_json") unless parsed.is_a?(Array)

      parsed.map { |segment| segment.to_h.transform_keys(&:to_s) }
    rescue JSON::ParserError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "segments_json")
    end

    def segment_number(segment, key, default: nil)
      raw = segment[key]
      return default if raw.nil? || raw == ""

      value = Float(raw)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) unless value.finite?

      value
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def validate_k_factor(value, field)
      raise Error, I18n.t("mechbox.errors.invalid_input", field:) if value < 0.0 || value > 0.5
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def optional_non_negative_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

      value
    end

    def optional_number(key, aliases: [])
      resolve_number(key, aliases:)
    end

    def resolve_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      value = Float(raw)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) unless value.finite?

      value
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end