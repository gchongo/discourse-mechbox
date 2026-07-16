# frozen_string_literal: true

module DiscourseMechbox
  # ISO 286 hole/shaft fit (clearance / transition / interference).
  # Ported from MechBox/src/utils/iso-286-calc.js (+ thermal diameter expansion).
  class FitCalculator
    class Error < StandardError
    end

    ISO286_NOMINAL_MAX = 500.0
    DEFAULT_ALPHA = 11.5e-6
    ALPHA_TEMP_COEFF = 2.4e-5
    REFERENCE_TEMP = 20.0

    IT_GRADE_FACTORS = {
      5 => 7,
      6 => 10,
      7 => 16,
      8 => 25,
      9 => 40,
      10 => 64,
      11 => 100,
    }.freeze

    SIZE_RANGES = [
      { max: 3, mid: 2 },
      { max: 6, mid: 4.5 },
      { max: 10, mid: 8 },
      { max: 18, mid: 14 },
      { max: 30, mid: 24 },
      { max: 50, mid: 40 },
      { max: 80, mid: 65 },
      { max: 120, mid: 100 },
      { max: 180, mid: 150 },
      { max: 250, mid: 215 },
      { max: 315, mid: 280 },
      { max: 400, mid: 360 },
      { max: 500, mid: 450 },
    ].freeze

    # Shaft upper deviation es (μm) by size range index.
    SHAFT_ES_TABLE = {
      "a" => [-270, -270, -280, -290, -300, -310, -320, -340, -360, -380, -400, -420, -440],
      "b" => [-140, -150, -150, -150, -160, -170, -180, -190, -220, -240, -260, -280, -300],
      "c" => [-60, -70, -80, -95, -110, -120, -130, -140, -170, -180, -200, -210, -230],
      "d" => [-16, -20, -25, -30, -35, -40, -45, -50, -60, -70, -80, -90, -100],
      "e" => [-10, -14, -18, -22, -26, -30, -34, -38, -45, -52, -58, -65, -72],
      "f" => [-6, -7, -8, -9, -10, -11, -12, -14, -16, -18, -20, -22, -24],
      "g" => [-4, -5, -6, -7, -8, -9, -10, -11, -13, -15, -17, -19, -21],
      "h" => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "j" => [1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
      "js" => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "k" => [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9],
      "n" => [4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 21],
      "p" => [6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40],
      "r" => [10, 12, 15, 18, 21, 24, 27, 30, 36, 42, 48, 54, 60],
      "s" => [14, 16, 19, 23, 27, 31, 35, 39, 46, 53, 60, 67, 74],
    }.freeze

    # Hole lower deviation EI (μm) by size range index.
    HOLE_EI_TABLE = {
      "B" => [140, 150, 150, 150, 160, 170, 180, 190, 220, 240, 260, 280, 300],
      "C" => [60, 70, 80, 95, 110, 120, 130, 140, 170, 180, 200, 210, 230],
      "D" => [20, 25, 30, 35, 40, 45, 50, 55, 65, 75, 85, 95, 105],
      "E" => [14, 18, 22, 26, 30, 34, 38, 42, 50, 58, 65, 72, 80],
      "F" => [7, 8, 9, 10, 11, 12, 13, 15, 17, 19, 21, 23, 25],
      "G" => [5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22],
      "H" => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "JS" => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "K" => [-2, -3, -3, -4, -4, -5, -5, -6, -7, -8, -9, -10, -11],
      "M" => [-3, -4, -4, -5, -6, -7, -8, -9, -11, -13, -15, -17, -19],
      "N" => [-4, -5, -6, -7, -8, -10, -11, -13, -15, -17, -20, -22, -25],
      "P" => [-6, -8, -10, -12, -14, -16, -18, -20, -24, -28, -32, -36, -40],
      "R" => [-10, -12, -15, -18, -21, -24, -27, -30, -36, -42, -48, -54, -60],
      "S" => [-14, -16, -19, -23, -27, -31, -35, -39, -46, -53, -60, -67, -74],
    }.freeze

    COMMON_FITS = [
      { "hole" => "H7", "shaft" => "g6", "label_key" => "preset_h7_g6" },
      { "hole" => "H7", "shaft" => "h6", "label_key" => "preset_h7_h6" },
      { "hole" => "H7", "shaft" => "k6", "label_key" => "preset_h7_k6" },
      { "hole" => "H7", "shaft" => "p6", "label_key" => "preset_h7_p6" },
      { "hole" => "H8", "shaft" => "f7", "label_key" => "preset_h8_f7" },
      { "hole" => "H8", "shaft" => "h7", "label_key" => "preset_h8_h7" },
      { "hole" => "H9", "shaft" => "d9", "label_key" => "preset_h9_d9" },
    ].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      nominal = positive_number("nominal_mm", aliases: %w[nominal nominalMm])
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "nominal_mm") if nominal > ISO286_NOMINAL_MAX

      hole_code = code("hole_code", aliases: %w[hole holeCode])
      shaft_code = code("shaft_code", aliases: %w[shaft shaftCode])

      hole = tolerance_limits(nominal, hole_code, "hole")
      shaft = tolerance_limits(nominal, shaft_code, "shaft")

      max_clearance = hole["max_size"] - shaft["min_size"]
      min_clearance = hole["min_size"] - shaft["max_size"]
      fit_type = classify_fit(min_clearance, max_clearance)

      result = {
        "calc_mode" => calc_mode,
        "nominal_mm" => nominal,
        "hole_code" => hole["designation"],
        "shaft_code" => shaft["designation"],
        "hole" => hole,
        "shaft" => shaft,
        "max_clearance" => round(max_clearance, 5),
        "min_clearance" => round(min_clearance, 5),
        "fit_type" => fit_type,
      }

      if calc_mode == "simple"
        return result.merge!("pass" => false, "estimate_only" => true)
      end

      mean_clearance = (max_clearance + min_clearance) / 2.0
      tolerance_span = max_clearance - min_clearance
      fit_quality = tolerance_span > 0 ? round(mean_clearance / tolerance_span, 2) : 0.0
      geometry_pass = evaluate_geometry(min_clearance, max_clearance)

      result.merge!(
        "mean_clearance" => round(mean_clearance, 5),
        "tolerance_span" => round(tolerance_span, 5),
        "hole_it" => hole["tolerance"],
        "shaft_it" => shaft["tolerance"],
        "fit_quality" => fit_quality,
        "pass" => geometry_pass,
        "estimate_only" => false,
      )

      if calc_mode == "professional"
        delta_t = optional_number("delta_t", aliases: %w[deltaT delta_t_c]) || 0.0
        alpha_hole =
          optional_number("alpha_hole", aliases: %w[alphaHole]) || DEFAULT_ALPHA
        alpha_shaft =
          optional_number("alpha_shaft", aliases: %w[alphaShaft]) || DEFAULT_ALPHA
        use_alpha_t =
          if @inputs.key?("use_alpha_temperature") || @inputs.key?("useAlphaTemperature")
            truthy?(@inputs["use_alpha_temperature"] || @inputs["useAlphaTemperature"])
          else
            delta_t.abs >= 100
          end

        thermal_opts = {
          reference_temp: REFERENCE_TEMP,
          alpha_temp_coeff: ALPHA_TEMP_COEFF,
          use_alpha_temperature: use_alpha_t,
        }
        thermal_shaft = diameter_expansion(nominal, alpha_shaft, delta_t, thermal_opts)
        thermal_hole = diameter_expansion(nominal, alpha_hole, delta_t, thermal_opts)
        clearance_shift = thermal_hole - thermal_shaft
        min_hot = min_clearance + clearance_shift
        max_hot = max_clearance + clearance_shift
        thermal = evaluate_thermal(fit_type, min_hot, max_hot, delta_t)

        result.merge!(
          "delta_t" => delta_t,
          "alpha_hole" => alpha_hole,
          "alpha_shaft" => alpha_shaft,
          "alpha_temperature_used" => use_alpha_t,
          "thermal_shift" => round(clearance_shift, 5),
          "min_clearance_hot" => round(min_hot, 5),
          "max_clearance_hot" => round(max_hot, 5),
          "thermal_risk_key" => thermal[:risk_key],
          "pass" => geometry_pass && thermal[:pass],
        )
      end

      result
    end

    private

    def tolerance_limits(nominal, designation, kind)
      parsed = parse_designation(designation)
      letter = parsed[:letter]
      grade = parsed[:grade]
      it = it_tolerance(nominal, grade)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "it_grade") if it.nil?

      upper_letter = letter.upcase
      lower_letter = letter.downcase

      if kind == "hole"
        if upper_letter == "JS"
          ei = -it / 2.0
          es = it / 2.0
          return build_limits(nominal, designation, "hole", ei, es, it)
        end

        ei = lookup_deviation(HOLE_EI_TABLE, upper_letter, nominal)
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "hole_code") if ei.nil?

        return build_limits(nominal, designation, "hole", ei, ei + it, it)
      end

      if lower_letter == "js"
        es = it / 2.0
        ei = -it / 2.0
        return build_limits(nominal, designation, "shaft", ei, es, it)
      end

      es = lookup_deviation(SHAFT_ES_TABLE, lower_letter, nominal)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "shaft_code") if es.nil?

      build_limits(nominal, designation, "shaft", es - it, es, it)
    end

    def build_limits(nominal, designation, kind, lower_dev, upper_dev, it)
      {
        "designation" => designation,
        "kind" => kind,
        "nominal" => nominal,
        "lower_deviation" => round(lower_dev, 5),
        "upper_deviation" => round(upper_dev, 5),
        "tolerance" => round(it, 5),
        "min_size" => round(nominal + lower_dev, 5),
        "max_size" => round(nominal + upper_dev, 5),
      }
    end

    def parse_designation(code)
      match = code.to_s.strip.match(/\A([A-Za-z]+)(\d{1,2})\z/)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "tolerance_code") if match.nil?

      { letter: match[1], grade: match[2].to_i }
    end

    def it_tolerance(nominal, grade)
      factor = IT_GRADE_FACTORS[grade]
      return nil if factor.nil?

      (factor * tolerance_unit(nominal)) / 1000.0
    end

    def tolerance_unit(nominal)
      d = [nominal, 1.0].max
      0.45 * (d**(1.0 / 3.0)) + 0.001 * d
    end

    def range_index(nominal)
      SIZE_RANGES.each_with_index do |range, index|
        return index if nominal <= range[:max]
      end
      SIZE_RANGES.length - 1
    end

    def lookup_deviation(table, letter, nominal)
      row = table[letter]
      return nil if row.nil?

      row[range_index(nominal)] / 1000.0
    end

    def classify_fit(min_c, max_c)
      return "clearance" if min_c >= 0
      return "interference" if max_c <= 0

      "transition"
    end

    def evaluate_geometry(min_c, max_c)
      fit_type = classify_fit(min_c, max_c)
      case fit_type
      when "clearance"
        min_c >= 0
      when "interference"
        max_c <= 0
      else
        min_c <= 0 && max_c >= 0
      end
    end

    def evaluate_thermal(fit_type, min_hot, max_hot, delta_t)
      if delta_t.to_f.zero?
        return { pass: true, risk_key: nil }
      end

      if fit_type == "clearance" && min_hot < 0
        return { pass: false, risk_key: "thermal_interference_risk" }
      end
      if fit_type == "interference" && max_hot > 0
        return { pass: false, risk_key: "thermal_clearance_risk" }
      end
      if fit_type == "transition" && min_hot < 0 && max_hot < 0
        return { pass: false, risk_key: "thermal_interference_risk" }
      end
      if fit_type == "transition" && min_hot > 0 && max_hot > 0
        return { pass: false, risk_key: "thermal_clearance_risk" }
      end

      { pass: true, risk_key: nil }
    end

    def diameter_expansion(diameter, alpha, delta_t, options)
      return 0.0 if diameter.to_f.zero? || delta_t.to_f.zero?

      if options[:use_alpha_temperature] && options[:alpha_temp_coeff].to_f != 0
        alpha_mean = alpha * (1.0 + options[:alpha_temp_coeff] * delta_t / 2.0)
        return alpha_mean * diameter * delta_t
      end

      alpha * diameter * delta_t
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

    def code(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if raw.nil? || raw.to_s.strip.empty?

      raw.to_s.strip
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
