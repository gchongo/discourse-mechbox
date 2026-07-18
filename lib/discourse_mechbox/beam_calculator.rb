# frozen_string_literal: true

module DiscourseMechbox
  # Euler-Bernoulli beam front-end estimate ported from MechBox/src/utils/beam-calc.js.
  # Units: load N or N/mm, length mm, E MPa (N/mm^2), I mm^4, W mm^3.
  class BeamCalculator
    class Error < StandardError
    end

    MATERIALS = {
      "q235" => { name: "Q235 carbon structural steel", e: 206_000.0, sigma_allow: 157.0 },
      "q345" => { name: "Q345 low-alloy steel", e: 206_000.0, sigma_allow: 230.0 },
      "q195" => { name: "Q195 carbon structural steel", e: 206_000.0, sigma_allow: 130.0 },
      "q460" => { name: "Q460 high-strength low-alloy steel", e: 206_000.0, sigma_allow: 307.0 },
      "16mn" => { name: "16Mn low-alloy steel", e: 206_000.0, sigma_allow: 217.0 },
      "20" => { name: "20 carbon steel", e: 206_000.0, sigma_allow: 163.0 },
      "35" => { name: "35 carbon steel", e: 206_000.0, sigma_allow: 210.0 },
      "45" => { name: "45 carbon steel", e: 206_000.0, sigma_allow: 237.0 },
      "40cr" => { name: "40Cr alloy steel", e: 206_000.0, sigma_allow: 523.0 },
      "20crmnti" => { name: "20CrMnTi carburizing steel", e: 206_000.0, sigma_allow: 557.0 },
      "20cr" => { name: "20Cr carburizing steel", e: 206_000.0, sigma_allow: 360.0 },
      "35crmo" => { name: "35CrMo alloy steel", e: 206_000.0, sigma_allow: 557.0 },
      "42crmo" => { name: "42CrMo alloy steel", e: 206_000.0, sigma_allow: 620.0 },
      "38crmoal" => { name: "38CrMoAl nitriding steel", e: 206_000.0, sigma_allow: 557.0 },
      "65mn" => { name: "65Mn spring steel", e: 206_000.0, sigma_allow: 360.0 },
      "gcr15" => { name: "GCr15 bearing steel", e: 206_000.0, sigma_allow: 497.0 },
      "304" => { name: "304 stainless steel", e: 193_000.0, sigma_allow: 137.0 },
      "316" => { name: "316 stainless steel", e: 193_000.0, sigma_allow: 137.0 },
      "316l" => { name: "316L stainless steel", e: 193_000.0, sigma_allow: 113.0 },
      "6061-t6" => { name: "6061-T6 aluminum alloy", e: 68_900.0, sigma_allow: 184.0 },
      "7075-t6" => { name: "7075-T6 aluminum alloy", e: 71_700.0, sigma_allow: 335.0 },
      "2024-t4" => { name: "2024-T4 aluminum alloy", e: 73_100.0, sigma_allow: 217.0 },
      "5052-h32" => { name: "5052-H32 aluminum alloy", e: 70_300.0, sigma_allow: 129.0 },
      "ht200" => { name: "HT200 gray cast iron", e: 100_000.0, sigma_allow: 80.0 },
      "ht250" => { name: "HT250 gray cast iron", e: 110_000.0, sigma_allow: 100.0 },
      "qt400-18" => { name: "QT400-18 ductile iron", e: 160_000.0, sigma_allow: 167.0 },
      "qt500-7" => { name: "QT500-7 ductile iron", e: 170_000.0, sigma_allow: 213.0 },
      "pom" => { name: "POM", e: 2_800.0, sigma_allow: 43.0 },
      "pa66" => { name: "PA66 nylon", e: 2_900.0, sigma_allow: 40.0 },
      "peek" => { name: "PEEK", e: 3_600.0, sigma_allow: 60.0 },
    }.freeze

    CASES = %w[simply_center cantilever_end simply_uniform cantilever_uniform].freeze
    SECTIONS = %w[solid_round hollow_round rectangle].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      case_id = normalize_case(@inputs["case_id"] || @inputs["caseId"])
      section_type = normalize_section(@inputs["section_type"] || @inputs["sectionType"])
      section = calculate_section(section_type)

      span_length = positive_number("span_length_mm", aliases: %w[spanLength span_length L])
      load, load_input_key = load_for_case(case_id)
      material_id = (@inputs["material_id"] || @inputs["materialId"]).to_s.presence
      material = material_id && MATERIALS[material_id]

      elastic_modulus =
        optional_positive_number("elastic_modulus_mpa", aliases: %w[elasticModulus elastic_modulus E]) ||
          material&.dig(:e) ||
          210_000.0
      dynamic_factor =
        if calc_mode == "professional"
          optional_positive_number("dynamic_factor", aliases: %w[dynamicFactor]) || 1.0
        else
          1.0
        end
      stress_concentration =
        if calc_mode == "professional"
          optional_positive_number("stress_concentration", aliases: %w[stressConcentration Kt]) || 1.0
        else
          1.0
        end
      design_load = load * dynamic_factor

      allowable_stress =
        optional_positive_number("allowable_stress_mpa", aliases: %w[allowableStress allowable_stress]) ||
          material&.dig(:sigma_allow) ||
          (calc_mode == "simple" ? nil : 160.0)
      if calc_mode == "simple" && allowable_stress.nil?
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "material_id")
      end

      allowable_deflection =
        optional_positive_number("allowable_deflection_mm", aliases: %w[allowableDeflection allowable_deflection]) ||
          span_length / 1000.0

      moment = max_moment(case_id, design_load, span_length)
      deflection = max_deflection(case_id, design_load, span_length, elastic_modulus, section[:inertia])
      stress = (moment / section[:section_modulus]) * stress_concentration

      stress_pass = stress <= allowable_stress
      deflection_pass = deflection <= allowable_deflection
      char_dim = characteristic_dimension(section_type)
      span_ratio = char_dim.positive? ? span_length / char_dim : nil
      slenderness_warning = span_ratio.to_f > 40.0

      result = {
        "calc_mode" => calc_mode,
        "case_id" => case_id,
        "section_type" => section_type,
        "span_length_mm" => span_length,
        "load_input_key" => load_input_key,
        "elastic_modulus_mpa" => elastic_modulus,
        "material_id" => material_id,
        "material_name" => material&.dig(:name),
        "moment_nmm" => round(moment, 4),
        "deflection_mm" => round(deflection, 6),
        "stress_mpa" => round(stress, 6),
        "inertia_mm4" => round(section[:inertia], 6),
        "section_modulus_mm3" => round(section[:section_modulus], 6),
        "allowable_stress_mpa" => allowable_stress,
        "allowable_deflection_mm" => round(allowable_deflection, 6),
        "stress_pass" => stress_pass,
        "deflection_pass" => deflection_pass,
        "span_ratio" => span_ratio.nil? ? nil : round(span_ratio, 6),
        "slenderness_warning" => slenderness_warning,
        "pass" => stress_pass && deflection_pass,
      }

      if uniform_load_case?(case_id)
        result["line_load_n_per_mm"] = load
        result["design_line_load_n_per_mm"] = round(design_load, 4)
        result["legacy_load_n_used"] = load_input_key == "load_n"
      else
        result["load_n"] = load
        result["design_load_n"] = round(design_load, 4)
      end

      if calc_mode != "simple"
        result.merge!(
          "stress_utilization" => round(stress / allowable_stress, 6),
          "deflection_utilization" => round(deflection / allowable_deflection, 6),
          "min_section_modulus_stress_mm3" => round(moment / allowable_stress, 6),
          "min_inertia_deflection_mm4" =>
            round(
              min_inertia(case_id, design_load, span_length, elastic_modulus, allowable_deflection),
              6,
            ),
        )
      end

      if calc_mode == "professional"
        result.merge!(
          "dynamic_factor" => dynamic_factor,
          "stress_concentration" => stress_concentration,
          "fatigue_available" => false,
          "engineering_review_required" => true,
        )
      end

      result
    end

    private

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      case mode
      when "simple" then "simple"
      when "complete", "full" then "full"
      when "professional", "pro" then "professional"
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
      end
    end

    def normalize_case(raw)
      case_id = raw.to_s.presence || "simply_center"
      return case_id if CASES.include?(case_id)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "case_id")
    end

    def normalize_section(raw)
      section = raw.to_s.presence || "solid_round"
      return section if SECTIONS.include?(section)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "section_type")
    end

    def calculate_section(section_type)
      case section_type
      when "solid_round"
        diameter = positive_number("diameter_mm", aliases: %w[diameter d])
        {
          inertia: Math::PI * diameter**4 / 64.0,
          section_modulus: Math::PI * diameter**3 / 32.0,
        }
      when "hollow_round"
        diameter = positive_number("diameter_mm", aliases: %w[diameter D])
        inner = non_negative_number("inner_diameter_mm", aliases: %w[innerDiameter inner_diameter di])
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "inner_diameter_mm") if inner >= diameter

        {
          inertia: Math::PI * (diameter**4 - inner**4) / 64.0,
          section_modulus: Math::PI * (diameter**4 - inner**4) / (32.0 * diameter),
        }
      when "rectangle"
        width = positive_number("width_mm", aliases: %w[width b])
        height = positive_number("height_mm", aliases: %w[height h])
        {
          inertia: width * height**3 / 12.0,
          section_modulus: width * height**2 / 6.0,
        }
      end
    end

    def characteristic_dimension(section_type)
      case section_type
      when "solid_round", "hollow_round"
        resolve_number("diameter_mm", aliases: %w[diameter D]) || 30.0
      when "rectangle"
        resolve_number("height_mm", aliases: %w[height h]) || 30.0
      else
        30.0
      end
    end

    def load_for_case(case_id)
      if uniform_load_case?(case_id)
        load = resolve_number("line_load_n_per_mm", aliases: %w[lineLoad line_load q])
        return [validate_non_negative_value(load, "line_load_n_per_mm"), "line_load_n_per_mm"] unless load.nil?

        legacy = resolve_number("load_n", aliases: %w[load P])
        return [validate_non_negative_value(legacy, "load_n"), "load_n"] unless legacy.nil?

        raise Error, I18n.t("mechbox.errors.invalid_input", field: "line_load_n_per_mm")
      end

      load = non_negative_number("load_n", aliases: %w[load P])
      [load, "load_n"]
    end

    def uniform_load_case?(case_id)
      case_id == "simply_uniform" || case_id == "cantilever_uniform"
    end

    def validate_non_negative_value(value, field)
      raise Error, I18n.t("mechbox.errors.invalid_input", field:) if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field:) if value.negative?

      value
    end

    def max_deflection(case_id, load, span, elastic_modulus, inertia)
      case case_id
      when "cantilever_end"
        load * span**3 / (3.0 * elastic_modulus * inertia)
      when "simply_uniform"
        5.0 * load * span**4 / (384.0 * elastic_modulus * inertia)
      when "cantilever_uniform"
        load * span**4 / (8.0 * elastic_modulus * inertia)
      else
        load * span**3 / (48.0 * elastic_modulus * inertia)
      end
    end

    def max_moment(case_id, load, span)
      case case_id
      when "cantilever_end"
        load * span
      when "simply_uniform"
        load * span**2 / 8.0
      when "cantilever_uniform"
        load * span**2 / 2.0
      else
        load * span / 4.0
      end
    end

    def min_inertia(case_id, load, span, elastic_modulus, allowable_deflection)
      case case_id
      when "cantilever_end"
        load * span**3 / (3.0 * elastic_modulus * allowable_deflection)
      when "simply_uniform"
        5.0 * load * span**4 / (384.0 * elastic_modulus * allowable_deflection)
      when "cantilever_uniform"
        load * span**4 / (8.0 * elastic_modulus * allowable_deflection)
      else
        load * span**3 / (48.0 * elastic_modulus * allowable_deflection)
      end
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0

      value
    end

    def optional_positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0

      value
    end

    def non_negative_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

      value
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