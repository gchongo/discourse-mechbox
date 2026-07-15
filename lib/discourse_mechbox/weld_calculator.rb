# frozen_string_literal: true

module DiscourseMechbox
  # Fillet / butt weld strength.
  # Ported from MechBox/src/utils/weld-calc.js
  class WeldCalculator
    class Error < StandardError
    end

    STEEL_GRADES = {
      "Q235" => { label: "Q235 (GB)", fu: 370.0, fy: 235.0, gb_allow: 160.0 },
      "Q345" => { label: "Q345 (GB)", fu: 470.0, fy: 345.0, gb_allow: 200.0 },
      "S235" => { label: "S235 (EN)", fu: 360.0, fy: 235.0, gb_allow: 160.0 },
      "S355" => { label: "S355 (EN)", fu: 470.0, fy: 355.0, gb_allow: 200.0 },
      "A36" => { label: "A36 (AWS)", fu: 400.0, fy: 250.0, gb_allow: 165.0 },
    }.freeze

    DETAIL_CATEGORIES = {
      "high" => { label: "high", endurance_mpa: 90.0 },
      "medium" => { label: "medium", endurance_mpa: 71.0 },
      "low" => { label: "low", endurance_mpa: 50.0 },
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      weld_type = normalize_weld_type(@inputs["weld_type"] || @inputs["weldType"])

      if weld_type == "butt"
        calculate_butt(calc_mode)
      else
        calculate_fillet(calc_mode)
      end
    end

    private

    def calculate_fillet(calc_mode)
      steel_grade = resolve_grade
      leg = positive_number("leg_size_mm", aliases: %w[leg_size legSize])
      length = positive_number("weld_length_mm", aliases: %w[weld_length weldLength])
      force = number_or_zero("force_n", aliases: %w[force])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "force_n") if force.negative?

      throat = 0.7 * leg
      shear = shear_stress(force, throat, length)
      allow_override = optional_number("allow_shear_mpa", aliases: %w[allow_shear allowShear])

      gb = fillet_gb(steel_grade, throat, shear, allow_override)

      if calc_mode == "simple"
        return {
          "calc_mode" => calc_mode,
          "weld_type" => "fillet",
          "steel_grade" => steel_grade_key,
          "throat_mm" => throat,
          "shear_stress_mpa" => shear,
          "allowable_shear_mpa" => gb["allowable_shear_mpa"],
          "shear_pass" => gb["pass"],
          "utilization" => gb["utilization"],
          "standards" => [gb],
          "pass" => false,
          "estimate_only" => true,
        }
      end

      stds = compare_fillet_standards(steel_grade, throat, shear, allow_override)
      result = {
        "calc_mode" => calc_mode,
        "weld_type" => "fillet",
        "steel_grade" => steel_grade_key,
        "throat_mm" => throat,
        "shear_stress_mpa" => shear,
        "standards" => stds[:list],
        "all_pass" => stds[:all_pass],
        "strictest_standard" => stds[:strictest]["standard"],
        "strictest_allowable_mpa" => stds[:strictest]["allowable_shear_mpa"],
        "pass" => stds[:all_pass],
        "estimate_only" => false,
      }

      if calc_mode == "professional"
        combined = fillet_combined(leg:, length:, force:)
        ec = fillet_eurocode(steel_grade, throat, shear)
        combined_allow = ec["allowable_shear_mpa"]
        combined_pass = combined["equivalent_stress_mpa"] <= combined_allow
        haz = analyze_haz(steel_grade, leg:, length:, force:)

        fatigue = nil
        stress_range = optional_number("stress_range_mpa", aliases: %w[stress_range stressRange])
        if stress_range&.positive?
          fatigue = analyze_fatigue(stress_range)
        end

        result.merge!(
          "combined" => combined,
          "combined_allow_mpa" => combined_allow,
          "combined_pass" => combined_pass,
          "haz" => haz,
          "fatigue" => fatigue,
          "pass" => stds[:all_pass] && combined_pass && haz["pass"] && (fatigue ? fatigue["pass"] : true),
        )
      end

      result
    end

    def calculate_butt(calc_mode)
      steel_grade = resolve_grade
      thickness = positive_number("thickness_mm", aliases: %w[thickness])
      length = positive_number("weld_length_mm", aliases: %w[weld_length weldLength])
      force = number_or_zero("force_n", aliases: %w[force tension_force])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "force_n") if force.negative?

      area = thickness * length
      sigma = area.positive? ? force / area : 0.0
      allow_gb = round(steel_grade[:gb_allow] * 1.1, 1)
      beta_w = optional_number("correlation_factor", aliases: %w[correlationFactor]) || 0.85
      gamma_m2 = optional_number("partial_factor", aliases: %w[partialFactor]) || 1.25
      allow_ec = round(steel_grade[:fu] / (beta_w * gamma_m2), 1)
      allow_aws = round(0.6 * steel_grade[:fu], 1)

      gb = { "id" => "gb", "standard" => "GB (简化)", "allow_mpa" => allow_gb, "pass" => sigma <= allow_gb }
      eurocode = {
        "id" => "eurocode",
        "standard" => "EN 1993-1-8",
        "allow_mpa" => allow_ec,
        "pass" => sigma <= allow_ec,
      }
      aws = { "id" => "aws", "standard" => "AWS D1.1", "allow_mpa" => allow_aws, "pass" => sigma <= allow_aws }

      if calc_mode == "simple"
        return {
          "calc_mode" => calc_mode,
          "weld_type" => "butt",
          "steel_grade" => steel_grade_key,
          "area_mm2" => area,
          "normal_stress_mpa" => sigma,
          "standards" => [gb],
          "stress_pass" => gb["pass"],
          "pass" => false,
          "estimate_only" => true,
        }
      end

      result = {
        "calc_mode" => calc_mode,
        "weld_type" => "butt",
        "steel_grade" => steel_grade_key,
        "area_mm2" => area,
        "normal_stress_mpa" => sigma,
        "standards" => [gb, eurocode, aws],
        "pass" => gb["pass"] && eurocode["pass"] && aws["pass"],
        "estimate_only" => false,
      }

      if calc_mode == "professional"
        eff = optional_number("penetration_efficiency", aliases: %w[penetrationEfficiency]) || 1.0
        kf = optional_number("stress_concentration", aliases: %w[stressConcentration]) || 1.2
        raise Error, I18n.t("mechbox.errors.positive_values_required") if eff <= 0 || kf <= 0

        effective = sigma * kf / eff
        gb["pass"] = effective <= allow_gb
        eurocode["pass"] = effective <= allow_ec
        aws["pass"] = effective <= allow_aws
        result.merge!(
          "effective_stress_mpa" => effective,
          "penetration_efficiency" => eff,
          "stress_concentration" => kf,
          "standards" => [gb, eurocode, aws],
          "pass" => gb["pass"] && eurocode["pass"] && aws["pass"],
        )
      end

      result
    end

    def fillet_gb(grade, throat, shear, allow_override)
      allow = allow_override || grade[:gb_allow]
      {
        "id" => "gb",
        "standard" => "GB/T 985 (简化)",
        "throat_mm" => throat,
        "shear_stress_mpa" => shear,
        "allowable_shear_mpa" => allow.to_f,
        "pass" => shear <= allow,
        "utilization" => allow.positive? ? shear / allow : 0.0,
      }
    end

    def fillet_eurocode(grade, throat, shear)
      beta_w = optional_number("correlation_factor", aliases: %w[correlationFactor]) || 0.85
      gamma_m2 = optional_number("partial_factor", aliases: %w[partialFactor]) || 1.25
      allow = (grade[:fu] / (Math.sqrt(3) * beta_w)) / gamma_m2
      {
        "id" => "eurocode",
        "standard" => "EN 1993-1-8 (简化)",
        "throat_mm" => throat,
        "shear_stress_mpa" => shear,
        "allowable_shear_mpa" => round(allow, 1),
        "pass" => shear <= allow,
        "utilization" => allow.positive? ? shear / allow : 0.0,
        "beta_w" => beta_w,
        "gamma_m2" => gamma_m2,
      }
    end

    def fillet_aws(grade, throat, shear)
      allow = 0.3 * grade[:fu]
      {
        "id" => "aws",
        "standard" => "AWS D1.1 (简化)",
        "throat_mm" => throat,
        "shear_stress_mpa" => shear,
        "allowable_shear_mpa" => round(allow, 1),
        "pass" => shear <= allow,
        "utilization" => allow.positive? ? shear / allow : 0.0,
      }
    end

    def compare_fillet_standards(grade, throat, shear, allow_override)
      list = [
        fillet_gb(grade, throat, shear, allow_override),
        fillet_eurocode(grade, throat, shear),
        fillet_aws(grade, throat, shear),
      ]
      strictest = list.min_by { |s| s["allowable_shear_mpa"] }
      { list:, all_pass: list.all? { |s| s["pass"] }, strictest: }
    end

    def fillet_combined(leg:, length:, force:)
      throat = 0.7 * leg
      area = throat * length
      raise Error, I18n.t("mechbox.errors.positive_values_required") if area <= 0

      fx = number_or_zero("force_x_n", aliases: %w[force_x forceX])
      fy = number_or_zero("force_y_n", aliases: %w[force_y forceY])
      f = force.positive? ? force : Math.sqrt(fx**2 + fy**2)
      eccentricity = number_or_zero("eccentricity_mm", aliases: %w[eccentricity])
      moment = number_or_zero("moment_nm", aliases: %w[moment])
      moment = f * eccentricity / 1000.0 if moment <= 0 && eccentricity.positive?
      section = (length * (throat**2)) / 6.0
      tau = f / area
      sigma_b = section.positive? ? (moment * 1000.0) / section : 0.0
      equiv = Math.sqrt(sigma_b**2 + 3.0 * (tau**2))

      {
        "throat_mm" => throat,
        "area_mm2" => area,
        "shear_stress_mpa" => tau,
        "bending_stress_mpa" => sigma_b,
        "equivalent_stress_mpa" => equiv,
        "moment_nm" => moment,
      }
    end

    def analyze_haz(grade, leg:, length:, force:)
      heat_input = optional_number("heat_input", aliases: %w[heatInput]) || 1.5
      plate = optional_number("plate_thickness_mm", aliases: %w[plate_thickness plateThickness]) || 8.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if heat_input <= 0 || plate <= 0

      haz_width = round(0.8 * Math.sqrt(heat_input * plate), 2)
      reduction = heat_input > 2.5 ? 0.82 : 0.88
      haz_allow = grade[:gb_allow] * reduction
      throat = 0.7 * leg
      tau = force.positive? ? shear_stress(force, throat, length) : 0.0

      {
        "heat_input" => heat_input,
        "plate_thickness_mm" => plate,
        "haz_width_mm" => haz_width,
        "strength_reduction" => reduction,
        "haz_allow_shear_mpa" => round(haz_allow, 1),
        "weld_stress_mpa" => round(tau, 1),
        "pass" => tau <= 0 || tau <= haz_allow,
      }
    end

    def analyze_fatigue(stress_range)
      detail_key = (@inputs["detail_category"] || @inputs["detailCategory"] || "medium").to_s
      detail = DETAIL_CATEGORIES[detail_key] || DETAIL_CATEGORIES["medium"]
      cycles = (optional_number("cycles") || 1_000_000.0).to_f
      raise Error, I18n.t("mechbox.errors.positive_values_required") if cycles <= 0

      endurance = detail[:endurance_mpa]
      exponent = 3.0
      ref_cycles = 2_000_000.0
      allowable = endurance * ((ref_cycles / cycles)**(1.0 / exponent))
      life = ref_cycles * ((endurance / stress_range)**exponent)

      {
        "stress_range_mpa" => stress_range,
        "detail_category" => detail_key,
        "endurance_limit_mpa" => endurance,
        "allowable_at_cycles_mpa" => round(allowable, 1),
        "estimated_life_cycles" => [life, 1.0].max.round,
        "cycles" => cycles,
        "pass" => stress_range <= allowable,
        "utilization" => allowable.positive? ? stress_range / allowable : 0.0,
      }
    end

    def shear_stress(force, throat, length)
      area = throat * length
      return 0.0 if area <= 0
      force / area
    end

    def resolve_grade
      key = steel_grade_key
      STEEL_GRADES[key] || STEEL_GRADES["Q235"]
    end

    def steel_grade_key
      raw = (@inputs["steel_grade"] || @inputs["steelGrade"] || "Q235").to_s
      STEEL_GRADES.key?(raw) ? raw : "Q235"
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      case mode
      when "complete", "full"
        "full"
      when "professional", "pro"
        "professional"
      when "simple"
        "simple"
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
      end
    end

    def normalize_weld_type(raw)
      type = raw.to_s.presence || "fillet"
      case type
      when "fillet", "butt"
        type
      else
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "weld_type")
      end
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

    def number_or_zero(key, aliases: [])
      resolve_number(key, aliases:) || 0.0
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
