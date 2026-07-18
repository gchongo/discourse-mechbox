# frozen_string_literal: true

module DiscourseMechbox
  # O-ring gland design check ported from MechBox/src/utils/o-ring-calc.js
  # (Parker / ISO 3601 simplified). Lengths mm, pressure MPa, temperature °C,
  # stroke speed m/s. Compression/stretch inputs are percent (e.g. 20 = 20%).
  class ORingCalculator
    class Error < StandardError
    end

    MATERIALS = {
      "nbr" => { name: "NBR", swell: 1.0, max_temp_c: 100.0, hardness: 70 },
      "fkm" => { name: "FKM", swell: 1.02, max_temp_c: 200.0, hardness: 75 },
      "epdm" => { name: "EPDM", swell: 1.05, max_temp_c: 120.0, hardness: 70 },
    }.freeze

    SECTIONS_MM = [1.78, 2.62, 3.53, 5.33, 6.99].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def self.recommend_groove(bore_diameter_mm:, cross_section_mm: 3.53)
      cs = Float(cross_section_mm)
      bore = Float(bore_diameter_mm)
      {
        "groove_diameter_mm" => bore - 2.0 * cs * 0.75,
        "groove_width_mm" => cs * 1.4,
        "groove_depth_mm" => cs * 0.8,
        "compression_percent" => 20.0,
      }
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      cs = positive_number("cross_section_mm", aliases: %w[crossSection cross_section])
      groove_d = positive_number("groove_diameter_mm", aliases: %w[grooveDiameter groove_diameter])
      groove_w = positive_number("groove_width_mm", aliases: %w[grooveWidth groove_width])
      stretch = non_negative_number("stretch_percent", aliases: %w[stretchPercent], default: 2.0) / 100.0
      pressure = non_negative_number("pressure_mpa", aliases: %w[pressure], default: 0.0)
      target_compression =
        positive_number("compression_percent", aliases: %w[compressionPercent], default: 20.0) / 100.0

      # Match MechBox: installedID = grooveD*(1+stretch); freeID = installedID/(1+stretch) (= grooveD).
      installed_id = groove_d * (1.0 + stretch)
      free_id = installed_id / (1.0 + stretch)
      compression = cs * target_compression
      groove_depth = cs - compression
      recommended_width = cs * 1.4
      width_ok = groove_w >= cs * 1.2 && groove_w <= cs * 1.6
      gland_volume = groove_w * groove_depth
      ring_area = (Math::PI / 4.0) * cs * cs
      fill_percent = gland_volume.positive? ? (ring_area / gland_volume) * 100.0 : 0.0
      # Empirical contact-stress proxy from MechBox (not MPa absolute); keep identical.
      contact_stress = compression.positive? ? (0.5 + 0.5 * target_compression) * 2.0 : 0.0
      sealing_pressure = contact_stress * 10.0

      min_compression = pressure.positive? ? 12.0 : 15.0
      max_compression =
        if calc_mode == "simple"
          25.0
        else
          pressure.positive? ? 20.0 : 25.0
        end
      compression_pct = target_compression * 100.0
      compression_ok = compression_pct >= min_compression && compression_pct <= max_compression
      fill_ok = fill_percent >= 65.0 && fill_percent <= 85.0

      result = {
        "calc_mode" => calc_mode,
        "cross_section_mm" => round(cs, 6),
        "groove_diameter_mm" => round(groove_d, 6),
        "groove_width_mm" => round(groove_w, 6),
        "groove_depth_mm" => round(groove_depth, 6),
        "compression_mm" => round(compression, 6),
        "compression_percent" => round(compression_pct, 6),
        "compression_ok" => compression_ok,
        "min_compression_percent" => min_compression,
        "max_compression_percent" => max_compression,
        "recommended_width_mm" => round(recommended_width, 6),
        "width_ok" => width_ok,
        "fill_percent" => round(fill_percent, 6),
        "fill_ok" => fill_ok,
        "free_id_mm" => round(free_id, 6),
        "installed_id_mm" => round(installed_id, 6),
        "stretch_percent" => round(stretch * 100.0, 6),
        "sealing_pressure_estimate" => round(sealing_pressure, 6),
        "contact_stress_estimate" => round(contact_stress, 6),
        "pressure_mpa" => pressure,
        "notes_key" => pressure.positive? ? "dynamic" : "static",
        "pass" => compression_ok && width_ok && fill_ok,
      }

      if calc_mode == "full" || calc_mode == "professional"
        extrusion_gap =
          optional_non_negative_number("extrusion_gap_mm", aliases: %w[extrusionGap extrusion_gap]) || 0.15
        max_gap = pressure.positive? ? [0.05, 0.25 - pressure * 0.008].max : 0.3
        result["extrusion_gap_mm"] = round(extrusion_gap, 6)
        result["max_extrusion_gap_mm"] = round(max_gap, 6)
        result["extrusion_pass"] = extrusion_gap <= max_gap
        result["pass"] = result["pass"] && result["extrusion_pass"]

        material_id = (@inputs["material"] || "nbr").to_s
        mat = MATERIALS[material_id] || MATERIALS["nbr"]
        result["material"] = material_id
        result["material_name"] = mat[:name]
        result["effective_cross_section_mm"] = round(cs * mat[:swell], 6)
        temp = optional_number("operating_temp_c", aliases: %w[operatingTemp operating_temp]) || 25.0
        result["operating_temp_c"] = temp
        result["max_temp_c"] = mat[:max_temp_c]
        result["temp_pass"] = temp <= mat[:max_temp_c]
        result["pass"] = result["pass"] && result["temp_pass"]
      end

      if calc_mode == "professional"
        stroke_speed =
          optional_non_negative_number("stroke_speed_m_s", aliases: %w[strokeSpeed stroke_speed]) || 0.0
        result["stroke_speed_m_s"] = stroke_speed
        result["speed_pass"] = pressure.zero? || stroke_speed <= 0.5

        extrusion_gap = result["extrusion_gap_mm"]
        max_pressure =
          if extrusion_gap
            35.0 * (0.25 / [extrusion_gap, 0.05].max)
          else
            10.0
          end
        result["max_allow_pressure_mpa"] = round(max_pressure, 6)
        result["pressure_pass"] = pressure <= max_pressure
        result["pass"] = result["pass"] && result["speed_pass"] && result["pressure_pass"]

        thermal = optional_number("thermal_expansion", aliases: %w[thermalExpansion])
        unless thermal.nil?
          delta = thermal * cs
          result["thermal_expansion"] = thermal
          result["thermal_compression_change_mm"] = round(delta, 6)
          result["thermal_pass"] = compression + delta > cs * 0.1
          result["pass"] = result["pass"] && result["thermal_pass"]
        end
      end

      result
    end

    private

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def positive_number(key, aliases: [], default: nil)
      value = resolve_number(key, aliases:)
      value = default if value.nil? && !default.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.positive_values_required") if value <= 0.0

      value
    end

    def non_negative_number(key, aliases: [], default: nil)
      value = resolve_number(key, aliases:)
      value = default if value.nil? && !default.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil?
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.negative?

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
