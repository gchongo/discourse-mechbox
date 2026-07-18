# frozen_string_literal: true

module DiscourseMechbox
  # Heat-treatment engineering estimate ported from MechBox/src/utils/heat-treatment-calc.js.
  # CE (IIW), ideal critical diameter Di, Jominy HRC, Hollomon–Jaffe temper hardness.
  class HeatTreatmentCalculator
    class Error < StandardError
    end

    STEEL_PRESETS = {
      "1045" => { "C" => 0.45, "Mn" => 0.75, "Cr" => 0.0, "Mo" => 0.0, "V" => 0.0, "Ni" => 0.0, "Cu" => 0.0 },
      "4140" => { "C" => 0.4, "Mn" => 0.85, "Cr" => 0.95, "Mo" => 0.2, "V" => 0.0, "Ni" => 0.0, "Cu" => 0.0 },
      "4340" => { "C" => 0.4, "Mn" => 0.75, "Cr" => 0.8, "Mo" => 0.25, "V" => 0.0, "Ni" => 1.8, "Cu" => 0.0 },
      "8620" => { "C" => 0.2, "Mn" => 0.85, "Cr" => 0.5, "Mo" => 0.2, "V" => 0.0, "Ni" => 0.55, "Cu" => 0.0 },
    }.freeze

    ELEMENTS = %w[C Mn Cr Mo V Ni Cu].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      composition = resolve_composition
      grain_size = optional_number("grain_size", aliases: %w[grainSize]) || 7.0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "grain_size") if grain_size < 1.0 || grain_size > 8.0

      part_diameter = optional_positive("part_diameter_mm", aliases: %w[partDiameter]) || 50.0
      temper_temp = optional_number("temper_temp_c", aliases: %w[temperTemp]) || 550.0
      temper_time = optional_positive("temper_time_h", aliases: %w[temperTime]) || 2.0

      ce_info = carbon_equivalent(composition)
      ce = ce_info["ce"]
      hardenability = assess_hardenability(ce, part_diameter, grain_size)
      surface_hrc = hardenability["surface_hrc"]
      temper = tempered_hardness(surface_hrc, temper_temp, temper_time)

      result = {
        "calc_mode" => calc_mode,
        "composition" => composition,
        "carbon_equivalent" => ce,
        "weldability_key" => ce_info["weldability_key"],
        "grain_size" => grain_size,
        "part_diameter_mm" => part_diameter,
      }

      if calc_mode == "simple"
        result["hardenability"] = {
          "surface_hrc" => surface_hrc,
          "verdict_key" => hardenability["verdict_key"],
        }
        result["jominy_curve"] = []
        result["temper"] = nil
      else
        result["hardenability"] = hardenability
        result["jominy_curve"] = generate_jominy(ce, grain_size)
        result["temper"] = temper
        result["preheat_required"] = ce >= 0.45
        result["preheat_temp_c"] = if ce >= 0.6
          200.0
        else
          (ce >= 0.45 ? 150.0 : 0.0)
        end
        result["pass"] = hardenability["ratio"] <= 1.0
      end

      if calc_mode == "professional"
        depths = [0, 10, 20, 30, 40, 50]
        result["hardness_profile"] =
          depths.map { |d| { "distance_mm" => d, "hrc" => jominy_hardness(ce, d, grain_size) } }
        result["temper"] = temper
        min_hrc = optional_number("min_final_hrc", aliases: %w[minFinalHRC]) || 28.0
        max_hrc = optional_number("max_final_hrc", aliases: %w[maxFinalHRC]) || 45.0
        result["final_hardness_pass"] =
          temper["tempered_hrc"] >= min_hrc && temper["tempered_hrc"] <= max_hrc
        result["pass"] = result["pass"] && result["final_hardness_pass"]
      end

      result
    end

    private

    def resolve_composition
      preset_id = (@inputs["steel_preset"] || @inputs["preset"] || "4140").to_s
      base = (STEEL_PRESETS[preset_id] || STEEL_PRESETS["4140"]).dup
      ELEMENTS.each do |el|
        key = el
        alt = "composition_#{el.downcase}"
        raw = @inputs[key] || @inputs[alt] || @inputs.dig("composition", el) ||
          @inputs.dig("composition", el.downcase)
        next if raw.nil? || raw == ""

        base[el] = Float(raw)
      end
      base
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "composition")
    end

    def carbon_equivalent(comp)
      # IIW: CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15
      ce =
        comp["C"].to_f + comp["Mn"].to_f / 6.0 + (comp["Cr"].to_f + comp["Mo"].to_f + comp["V"].to_f) / 5.0 +
          (comp["Ni"].to_f + comp["Cu"].to_f) / 15.0
      weld =
        if ce < 0.35
          "excellent"
        elsif ce < 0.45
          "fair"
        elsif ce < 0.6
          "poor"
        else
          "bad"
        end
      { "ce" => round(ce, 3), "weldability_key" => weld }
    end

    def ideal_critical_diameter(ce, grain_size)
      grain_factor = 1.0 + (grain_size - 7.0) * 0.08
      di = 25.0 * (1.0 - Math.exp(-ce * 1.8)) * grain_factor
      round([5.0, di].max, 1)
    end

    def jominy_hardness(ce, distance_mm, grain_size)
      surface = 20.0 + 58.0 * (1.0 - Math.exp(-ce * 0.85))
      grain_adj = (grain_size - 7.0) * 1.5
      drop_rate = 0.35 + ce * 0.15
      hrc = surface - drop_rate * distance_mm + grain_adj
      round(clamp(hrc, 18.0, 65.0), 1)
    end

    def generate_jominy(ce, grain_size, max_distance = 50, step = 2)
      (0..max_distance).step(step).map do |d|
        { "distance_mm" => d, "hrc" => jominy_hardness(ce, d, grain_size) }
      end
    end

    def assess_hardenability(ce, part_diameter, grain_size)
      di = ideal_critical_diameter(ce, grain_size)
      ratio = part_diameter / di
      if ratio <= 0.5
        verdict = "full"
        core = jominy_hardness(ce, part_diameter * 0.25, grain_size)
      elsif ratio <= 1.0
        verdict = "core_partial"
        core = jominy_hardness(ce, part_diameter * 0.5, grain_size)
      else
        verdict = "surface_only"
        core = jominy_hardness(ce, part_diameter * 0.8, grain_size)
      end
      {
        "ideal_critical_diameter_mm" => di,
        "part_diameter_mm" => part_diameter,
        "ratio" => round(ratio, 2),
        "verdict_key" => verdict,
        "estimated_core_hrc" => core,
        "surface_hrc" => jominy_hardness(ce, 0, grain_size),
      }
    end

    def tempered_hardness(as_quenched_hrc, temper_temp_c, time_hours)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "as_quenched_hrc") if as_quenched_hrc <= 0

      t_sec = [time_hours, 0.01].max * 3600.0
      t_k = temper_temp_c + 273.0
      pj = t_k * (20.0 + Math.log10(t_sec))
      temp_factor = (temper_temp_c / 600.0)**1.4
      time_factor = Math.log10(time_hours + 0.1) + 1.0
      loss = as_quenched_hrc * temp_factor * time_factor * 0.35
      tempered = clamp(as_quenched_hrc - loss, 18.0, as_quenched_hrc)
      state =
        if tempered >= 50
          "high"
        elsif tempered >= 40
          "qt"
        elsif tempered >= 30
          "medium"
        else
          "soft"
        end
      {
        "as_quenched_hrc" => as_quenched_hrc,
        "tempered_hrc" => round(tempered, 1),
        "hollomon_jaffe" => round(pj, 0),
        "temper_temp_c" => temper_temp_c,
        "temper_time_h" => time_hours,
        "temper_state" => state,
        "hardness_drop" => round(as_quenched_hrc - tempered, 1),
      }
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def optional_positive(key, aliases: [])
      value = optional_number(key, aliases:)
      return nil if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def clamp(value, lo, hi)
      [[value, lo].max, hi].min
    end

    def round(value, digits)
      factor = 10.0**digits
      (value * factor).round / factor
    end
  end
end
