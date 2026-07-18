# frozen_string_literal: true

require "json"

module DiscourseMechbox
  # Manufacturing estimates ported from MechBox machining-calc.js + casting-calc.js.
  # analysis_type: machining | casting. Lengths mm; draft angle degrees.
  class ManufacturingCalculator
    class Error < StandardError
    end

    TOLERANCE_GRADES = {
      "coarse" => { id: "coarse", factor: 1.4 },
      "medium" => { id: "medium", factor: 1.0 },
      "fine" => { id: "fine", factor: 0.6 },
    }.freeze

    # Single-side radial allowance by diameter band (mm).
    ROUGH_TURN = [
      { max_d: 30.0, rough: 1.5, semi: 0.5, finish: 0.15 },
      { max_d: 50.0, rough: 2.0, semi: 0.6, finish: 0.2 },
      { max_d: 120.0, rough: 2.5, semi: 0.8, finish: 0.25 },
      { max_d: 250.0, rough: 3.0, semi: 1.0, finish: 0.3 },
      { max_d: Float::INFINITY, rough: 4.0, semi: 1.2, finish: 0.4 },
    ].freeze

    CAST_MATERIALS = {
      "sand_iron" => { name: "sand_iron", base_draft: 1.5, deep_factor: 0.02 },
      "sand_steel" => { name: "sand_steel", base_draft: 2.0, deep_factor: 0.025 },
      "die_aluminum" => { name: "die_aluminum", base_draft: 0.75, deep_factor: 0.015 },
      "sand_aluminum" => { name: "sand_aluminum", base_draft: 1.0, deep_factor: 0.018 },
      "investment" => { name: "investment", base_draft: 0.5, deep_factor: 0.01 },
    }.freeze

    SURFACE_TYPES = {
      "external" => { name: "external", factor: 1.0 },
      "internal" => { name: "internal", factor: 1.5 },
      "deep_core" => { name: "deep_core", factor: 2.0 },
    }.freeze

    MODE_OPS = {
      "simple" => %w[rough finish],
      "full" => %w[rough semi finish],
      "professional" => %w[rough semi finish],
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      analysis = normalize_analysis(@inputs["analysis_type"] || @inputs["analysisType"])

      case analysis
      when "machining"
        calculate_machining(calc_mode)
      when "casting"
        calculate_casting(calc_mode)
      end
    end

    private

    def calculate_machining(calc_mode)
      diameter = positive_number("nominal_diameter_mm", aliases: %w[nominalDiameter diameter])
      length = positive_number("length_mm", aliases: %w[length])
      grade_key = (@inputs["tolerance_grade"] || @inputs["toleranceGrade"] || "medium").to_s
      grade = TOLERANCE_GRADES[grade_key] || TOLERANCE_GRADES["medium"]
      row = lookup_row(diameter)
      ops = resolve_operations(calc_mode)

      details = []
      total_radial = 0.0
      ops.each do |op|
        allowance =
          case op
          when "rough" then row[:rough]
          when "semi" then row[:semi]
          when "finish" then row[:finish]
          else
            Float(op)
          end
        allowance *= grade[:factor]
        total_radial += allowance
        details << { "operation" => op.to_s, "radial_allowance_mm" => round(allowance, 6) }
      end

      total_diameter = total_radial * 2.0
      end_face =
        optional_non_negative_number("end_face_allowance_mm", aliases: %w[endFaceAllowance]) ||
          (calc_mode == "simple" ? 1.0 : 2.0)
      stock_diameter = diameter + total_diameter
      stock_length = length + end_face * 2.0
      removal_volume = (Math::PI / 4.0) * (stock_diameter**2 - diameter**2) * stock_length

      result = {
        "calc_mode" => calc_mode,
        "analysis_type" => "machining",
        "nominal_diameter_mm" => diameter,
        "length_mm" => length,
        "tolerance_grade" => grade_key,
        "operations" => ops,
        "details" => details,
        "total_radial_allowance_mm" => round(total_radial, 6),
        "total_diameter_allowance_mm" => round(total_diameter, 6),
        "end_face_allowance_mm" => end_face,
        "recommended_stock_diameter_mm" => round(stock_diameter, 6),
        "recommended_stock_length_mm" => round(stock_length, 6),
        "material_removal_volume_mm3" => round(removal_volume, 6),
      }

      if calc_mode != "simple"
        grinding = grinding_allowance(diameter)
        result["grinding_allowance_mm"] = round(grinding[:radial], 6)
        result["grinding_diameter_allowance_mm"] = round(grinding[:diameter], 6)
        result["min_stock_diameter_mm"] = round(diameter + row[:finish] * 2.0 * grade[:factor], 6)
        result["stock_margin_mm"] = round(stock_diameter - result["min_stock_diameter_mm"], 6)
      end

      if calc_mode == "professional"
        removal_rate =
          optional_positive_number("removal_rate_mm3_min", aliases: %w[removalRate]) || 50.0
        result["removal_rate_mm3_min"] = removal_rate
        result["estimated_machining_minutes"] = round(removal_volume / removal_rate, 6)
        result["total_with_grinding_mm"] =
          round(stock_diameter + result["grinding_diameter_allowance_mm"].to_f, 6)
      end

      result
    end

    def calculate_casting(calc_mode)
      material_id = (@inputs["cast_material"] || @inputs["material"] || "sand_iron").to_s
      mat = CAST_MATERIALS[material_id] || CAST_MATERIALS["sand_iron"]
      surface_id = (@inputs["surface_type"] || @inputs["surfaceType"] || "external").to_s
      surf = SURFACE_TYPES[surface_id] || SURFACE_TYPES["external"]
      depth = positive_number("depth_mm", aliases: %w[depth])
      rough = truthy?(@inputs["rough_surface"] || @inputs["roughSurface"])
      texture = rough ? 1.2 : 1.0

      angle = (mat[:base_draft] + mat[:deep_factor] * Math.sqrt(depth)) * surf[:factor] * texture
      if calc_mode != "simple"
        imperfection =
          optional_positive_number("imperfection_factor", aliases: %w[imperfectionFactor]) || 1.05
        angle *= imperfection
      end
      min_angle = optional_non_negative_number("min_draft_deg", aliases: %w[minDraft]) || 0.5
      recommended = [min_angle, angle].max
      rad = recommended * Math::PI / 180.0
      linear_per_side = depth * Math.tan(rad)
      total_width = 2.0 * linear_per_side

      result = {
        "calc_mode" => calc_mode,
        "analysis_type" => "casting",
        "cast_material" => material_id,
        "surface_type" => surface_id,
        "depth_mm" => depth,
        "rough_surface" => rough,
        "draft_angle_deg" => round(recommended, 6),
        "linear_increase_per_side_mm" => round(linear_per_side, 6),
        "total_width_increase_mm" => round(total_width, 6),
        "min_draft_deg" => min_angle,
        "pass" => recommended >= min_angle,
        "note_key" => recommended > 3.0 ? "high_draft" : "normal",
      }

      actual = optional_non_negative_number("actual_draft_angle_deg", aliases: %w[actualDraftAngle])
      if actual
        result["actual_draft_angle_deg"] = actual
        result["verify_pass"] = actual >= recommended - 0.1
        result["verify_margin_deg"] = round(actual - recommended, 6)
        result["pass"] = result["verify_pass"]
      end

      result
    end

    def lookup_row(diameter)
      ROUGH_TURN.find { |row| diameter <= row[:max_d] } || ROUGH_TURN.last
    end

    def grinding_allowance(diameter)
      row = lookup_row(diameter)
      { radial: row[:finish], diameter: row[:finish] * 2.0 }
    end

    def resolve_operations(calc_mode)
      raw = @inputs["operations"] || @inputs["operations_json"] || @inputs["operationsJson"]
      if calc_mode != "simple" && raw.present?
        parsed =
          if raw.is_a?(Array)
            raw
          else
            JSON.parse(raw.to_s)
          end
        ops = Array(parsed).map(&:to_s).reject(&:blank?)
        return ops if ops.any?
      end
      MODE_OPS[calc_mode] || MODE_OPS["full"]
    rescue JSON::ParserError, TypeError
      # Comma-separated fallback: "rough,semi,finish"
      if raw.is_a?(String) && raw.include?(",")
        ops = raw.split(",").map(&:strip).reject(&:blank?)
        return ops if ops.any?
      end
      MODE_OPS[calc_mode] || MODE_OPS["full"]
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def normalize_analysis(raw)
      value = raw.to_s.presence || "machining"
      return "machining" if value == "machining"
      return "casting" if value == "casting"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "analysis_type")
    end

    def truthy?(raw)
      raw == true || raw.to_s == "true" || raw.to_s == "1"
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def optional_positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def optional_non_negative_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

      value
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
