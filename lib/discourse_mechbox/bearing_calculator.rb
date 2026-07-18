# frozen_string_literal: true

module DiscourseMechbox
  # Bearing life per ISO 281: L10 / Lnm hours.
  # Ported from MechBox/src/utils/bearing-calc.js + bearing-xy-tables.js.
  class BearingCalculator
    class Error < StandardError
    end

    RELIABILITY_FACTORS = {
      90 => 1.0,
      95 => 0.64,
      96 => 0.55,
      97 => 0.47,
      98 => 0.37,
      99 => 0.25,
    }.freeze

    LIFE_CONDITION_FACTORS = {
      "clean" => 1.5,
      "standard" => 1.0,
      "contaminated" => 0.5,
      "heavy" => 0.3,
    }.freeze

    TEMPERATURE_FACTORS = {
      120 => 1.0,
      150 => 0.9,
      175 => 0.8,
      200 => 0.75,
      250 => 0.5,
    }.freeze

    MOUNTING = {
      "single" => { c: 1.0, c0: 1.0, y: 1.0, stiffness: 1.0 },
      "duplex-db" => { c: 1.0, c0: 1.0, y: 0.72, stiffness: 2.0 },
      "duplex-df" => { c: 1.0, c0: 1.0, y: 0.72, stiffness: 2.0 },
      "duplex-dt" => { c: 2.0, c0: 2.0, y: 1.0, stiffness: 1.0 },
    }.freeze

    # Compact ISO/SKF-style X,Y series table.
    SERIES = {
      "deep-groove-light" => {
        type: "ball", e: 0.22, x1: 1.0, y1: 0.0, x2: 0.56, y2: 1.99,
      },
      "deep-groove-medium" => {
        type: "ball", e: 0.23, x1: 1.0, y1: 0.0, x2: 0.56, y2: 1.99,
      },
      "deep-groove-heavy" => {
        type: "ball", e: 0.26, x1: 1.0, y1: 0.0, x2: 0.56, y2: 1.99,
      },
      "angular-25" => {
        type: "ball", e: 0.68, x1: 1.0, y1: 0.0, x2: 0.41, y2: 0.87,
      },
      "angular-40" => {
        type: "ball", e: 1.14, x1: 1.0, y1: 0.0, x2: 0.35, y2: 0.57,
      },
      "self-aligning" => {
        type: "ball", e: 0.3, x1: 1.0, y1: 0.0, x2: 0.65, y2: 3.5,
      },
      "cylindrical-roller" => {
        type: "roller", e: 0.25, x1: 1.0, y1: 0.0, x2: 0.92, y2: 0.0,
      },
      "spherical-roller" => {
        type: "roller", e: 0.3, x1: 1.0, y1: 0.0, x2: 0.67, y2: 2.3,
      },
      "taper-roller" => {
        type: "roller", e: 0.35, x1: 1.0, y1: 0.0, x2: 0.4, y2: 1.5,
      },
      "thrust-ball" => {
        type: "ball", e: 0.0, x1: 0.0, y1: 1.0, x2: 0.0, y2: 1.0, axial_only: true,
      },
    }.freeze

    # Optional model → C / C0 (N) presets for UX.
    MODEL_PRESETS = {
      "6204" => { series: "deep-groove-medium", c: 12_700, c0: 6550, type: "ball" },
      "6205" => { series: "deep-groove-medium", c: 14_000, c0: 7800, type: "ball" },
      "6206" => { series: "deep-groove-medium", c: 19_500, c0: 11_300, type: "ball" },
      "6208" => { series: "deep-groove-medium", c: 32_500, c0: 19_000, type: "ball" },
      "6305" => { series: "deep-groove-heavy", c: 22_500, c0: 11_400, type: "ball" },
      "6308" => { series: "deep-groove-heavy", c: 42_300, c0: 24_000, type: "ball" },
      "6005" => { series: "deep-groove-light", c: 11_200, c0: 5850, type: "ball" },
      "NU206" => { series: "cylindrical-roller", c: 44_000, c0: 36_500, type: "roller" },
      "30206" => { series: "taper-roller", c: 43_600, c0: 50_000, type: "roller" },
    }.freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      arrangement = normalize_mounting(@inputs["mounting_arrangement"] || @inputs["mountingArrangement"])
      mounting = MOUNTING[arrangement]

      apply_model_preset!

      dynamic_c = positive_number("dynamic_load_n", aliases: %w[dynamicLoad dynamic_load C])
      static_c0 = optional_number("static_load_n", aliases: %w[staticLoad static_load C0])
      fr = number("radial_load_n", aliases: %w[radialLoad radial_load Fr])
      fa = optional_number("axial_load_n", aliases: %w[axialLoad axial_load Fa]) || 0.0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "radial_load_n") if fr < 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "axial_load_n") if fa < 0

      rpm = positive_number("rpm", aliases: %w[speed_rpm n])
      target_hours =
        optional_number("target_hours", aliases: %w[targetHours]) || 10_000.0
      axial_preload =
        if calc_mode == "simple"
          0.0
        else
          optional_number("axial_preload_n", aliases: %w[axialPreload]) || 0.0
        end

      bearing_type = normalize_bearing_type(@inputs["bearing_type"] || @inputs["bearingType"])
      series_id = (@inputs["series_id"] || @inputs["seriesId"]).to_s.presence
      auto_lookup =
        calc_mode != "simple" &&
          truthy?(@inputs.fetch("auto_lookup", @inputs.fetch("autoLookup", true)))

      x = optional_number("x", aliases: %w[factor_x factorX])
      y = optional_number("y", aliases: %w[factor_y factorY])
      xy_info = nil

      if auto_lookup
        series_id = series_id.presence || "deep-groove-medium"
        xy_info = lookup_xy(series_id, fr, fa)
        x = xy_info[:x]
        y = xy_info[:y]
        bearing_type = xy_info[:bearing_type]
      else
        x = x.nil? ? 1.0 : x
        y = y.nil? ? 0.0 : y
      end

      effective_c = dynamic_c * mounting[:c]
      effective_c0 = static_c0.nil? ? nil : static_c0 * mounting[:c0]

      effective_fa = fa.abs + [axial_preload, 0.0].max
      y_adj = y * mounting[:y]
      equivalent = x * fr.abs + y_adj * effective_fa

      if calc_mode == "simple" && effective_fa > 0 && y_adj <= 0 &&
           optional_number("simple_equivalent_load_n", aliases: %w[simpleEquivalentLoad]).nil?
        # Allow compute with Y=0 (pure radial formula) but flag attention via estimate_only.
      end

      simple_p = optional_number("simple_equivalent_load_n", aliases: %w[simpleEquivalentLoad])
      p = simple_p || equivalent

      l10 = l10_million(effective_c, p, bearing_type)

      a1 = 1.0
      a_iso = 1.0
      a2 = 1.0

      if calc_mode != "simple"
        reliability = (@inputs["reliability"] || 90).to_i
        a1 = RELIABILITY_FACTORS[reliability] ||
          optional_number("reliability_factor", aliases: %w[reliabilityFactor]) || 1.0
        condition =
          (@inputs["life_condition"] || @inputs["lifeCondition"] || "standard").to_s
        a_iso =
          LIFE_CONDITION_FACTORS[condition] ||
            optional_number("life_condition_factor", aliases: %w[lifeConditionFactor]) || 1.0
      end

      if calc_mode == "professional"
        temp =
          optional_number("operating_temp_c", aliases: %w[operatingTemp operating_temp]) || 120.0
        a2 =
          optional_number("temperature_factor", aliases: %w[temperatureFactor]) ||
            temperature_factor(temp)
      end

      # a2 is applied as a life modifier (MechBox / simplified ISO 281 practice).
      lnm = l10 * a1 * a_iso * a2
      hours = life_hours(lnm, rpm)

      min_static = optional_number("min_static_safety", aliases: %w[minStaticSafety]) || 1.5
      static_safety =
        if effective_c0 && p > 0
          effective_c0 / p
        end
      static_pass = static_safety.nil? || static_safety >= min_static
      life_pass = hours.finite? && hours >= target_hours

      speed_pass = true
      limiting_speed = nil
      if calc_mode == "professional"
        limiting_speed =
          optional_number("limiting_speed_rpm", aliases: %w[limitingSpeed limiting_speed])
        speed_pass = limiting_speed.nil? || rpm <= limiting_speed
      end

      radial_stiffness =
        if calc_mode == "professional" && effective_c > 0
          0.15 * Math.sqrt(effective_c / 1000.0) * mounting[:stiffness]
        end

      result = {
        "calc_mode" => calc_mode,
        "bearing_type" => bearing_type,
        "series_id" => series_id,
        "bearing_model" => (@inputs["bearing_model"] || @inputs["bearingModel"]).to_s.presence,
        "dynamic_load_n" => dynamic_c,
        "static_load_n" => static_c0,
        "effective_dynamic_load" => round(effective_c, 2),
        "effective_static_load" => effective_c0.nil? ? nil : round(effective_c0, 2),
        "radial_load_n" => fr,
        "axial_load_n" => fa,
        "effective_axial_load" => round(effective_fa, 2),
        "axial_preload_applied" => round([axial_preload, 0.0].max, 2),
        "x" => round(x, 4),
        "y" => round(y_adj, 4),
        "equivalent_load" => round(p, 2),
        "mounting_arrangement" => arrangement,
        "rpm" => rpm,
        "target_hours" => target_hours,
        "l10_million_rev" => finite_or_nil(l10),
        "modified_life_million_rev" => finite_or_nil(lnm),
        "reliability_factor" => a1,
        "life_condition_factor" => a_iso,
        "temperature_factor" => a2,
        "life_hours" => finite_or_nil(hours),
        "static_safety_factor" => static_safety.nil? ? nil : round(static_safety, 3),
        "static_pass" => static_pass,
        "life_pass" => life_pass,
        "speed_pass" => speed_pass,
        "limiting_speed_rpm" => limiting_speed,
        "radial_stiffness" => radial_stiffness.nil? ? nil : round(radial_stiffness, 3),
        "xy_condition" => xy_info && xy_info[:condition],
        "fa_over_fr" => xy_info && xy_info[:fa_over_fr],
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      result.merge!(
        "pass" => life_pass && static_pass && speed_pass,
        "estimate_only" => false,
      )
    end

    private

    def apply_model_preset!
      model = (@inputs["bearing_model"] || @inputs["bearingModel"]).to_s.strip.upcase
      return if model.empty?

      preset = MODEL_PRESETS[model]
      return unless preset

      @inputs["series_id"] = @inputs["series_id"].presence || @inputs["seriesId"].presence ||
        preset[:series]
      @inputs["bearing_type"] = @inputs["bearing_type"].presence || @inputs["bearingType"].presence ||
        preset[:type]
      if resolve_number("dynamic_load_n", aliases: %w[dynamicLoad dynamic_load C]).nil?
        @inputs["dynamic_load_n"] = preset[:c]
      end
      if resolve_number("static_load_n", aliases: %w[staticLoad static_load C0]).nil?
        @inputs["static_load_n"] = preset[:c0]
      end
    end

    def lookup_xy(series_id, fr, fa)
      series = SERIES[series_id] || SERIES["deep-groove-medium"]
      fr_abs = fr.abs
      fa_abs = fa.abs

      if series[:axial_only]
        return {
          x: 0.0,
          y: 1.0,
          bearing_type: series[:type],
          condition: "axial_only",
          fa_over_fr: fr_abs > 0 ? fa_abs / fr_abs : nil,
        }
      end

      ratio =
        if fr_abs > 0
          fa_abs / fr_abs
        elsif fa_abs > 0
          Float::INFINITY
        else
          0.0
        end
      use_axial = ratio > series[:e]

      {
        x: use_axial ? series[:x2] : series[:x1],
        y: use_axial ? series[:y2] : series[:y1],
        bearing_type: series[:type],
        condition: use_axial ? "fa_fr_gt_e" : "fa_fr_le_e",
        fa_over_fr: ratio.finite? ? round(ratio, 4) : nil,
      }
    end

    def l10_million(dynamic_load, equivalent_load, bearing_type)
      return Float::INFINITY if equivalent_load <= 0

      (dynamic_load / equivalent_load)**life_exponent(bearing_type)
    end

    def life_exponent(bearing_type)
      bearing_type == "roller" ? (10.0 / 3.0) : 3.0
    end

    def life_hours(l10_million, rpm)
      return Float::INFINITY if rpm <= 0 || !l10_million.finite?

      (l10_million * 1_000_000.0) / (rpm * 60.0)
    end

    def temperature_factor(temp_c)
      factor = 1.0
      TEMPERATURE_FACTORS.keys.sort.each { |t| factor = TEMPERATURE_FACTORS[t] if temp_c >= t }
      factor
    end

    def finite_or_nil(value)
      return nil unless value.finite?

      round(value, 4)
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

    def normalize_mounting(raw)
      key = raw.to_s.presence || "single"
      return key if MOUNTING.key?(key)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "mounting_arrangement")
    end

    def normalize_bearing_type(raw)
      key = raw.to_s.presence || "ball"
      return key if %w[ball roller].include?(key)

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "bearing_type")
    end

    def positive_number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0

      value
    end

    def number(key, aliases: [])
      value = resolve_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?

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

    def truthy?(value)
      return value if value == true || value == false

      %w[1 true yes on].include?(value.to_s.downcase)
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
