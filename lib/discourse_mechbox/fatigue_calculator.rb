# frozen_string_literal: true

module DiscourseMechbox
  # Fatigue life: Basquin S-N + Miner cumulative damage.
  # Ported from MechBox/src/utils/fatigue-calc.js.
  # Units: stress MPa, life cycles.
  class FatigueCalculator
    class Error < StandardError
    end

    SN_MATERIALS = {
      "steel_45" => {
        name: "45 steel QT",
        uts: 600.0,
        yield_min: 355.0,
        endurance_limit: 280.0,
        sf: 900.0,
        b: -0.085,
        cycle_limit: 1_000_000.0,
      },
      "steel_40cr" => {
        name: "40Cr QT",
        uts: 785.0,
        yield_min: 540.0,
        endurance_limit: 350.0,
        sf: 1100.0,
        b: -0.09,
        cycle_limit: 1_000_000.0,
      },
      "spring_steel" => {
        name: "Spring steel",
        uts: 1600.0,
        yield_min: 1400.0,
        endurance_limit: 450.0,
        sf: 2000.0,
        b: -0.1,
        cycle_limit: 1_000_000.0,
      },
      "aluminum_6061" => {
        name: "6061-T6 aluminum",
        uts: 310.0,
        yield_min: 276.0,
        endurance_limit: 97.0,
        sf: 450.0,
        b: -0.102,
        cycle_limit: 500_000_000.0,
      },
      "cast_iron" => {
        name: "Gray cast iron",
        uts: 250.0,
        yield_min: 200.0,
        endurance_limit: 100.0,
        sf: 400.0,
        b: -0.08,
        cycle_limit: 1_000_000.0,
      },
    }.freeze

    MEAN_METHODS = %w[goodman soderberg].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      material_key = normalize_material(@inputs["material"] || @inputs["sn_material"] || "steel_45")
      mat = SN_MATERIALS[material_key]

      raw_amplitude =
        number_or_zero("stress_amplitude_mpa", aliases: %w[stressAmplitude stress_amplitude])
      raise Error, I18n.t("mechbox.errors.positive_values_required") if raw_amplitude < 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "stress_amplitude_mpa") if raw_amplitude <= 0

      mean_stress =
        if calc_mode == "professional"
          number_or_zero("mean_stress_mpa", aliases: %w[meanStress mean_stress])
        else
          0.0
        end
      raise Error, I18n.t("mechbox.errors.positive_values_required") if mean_stress < 0

      mean_method =
        normalize_mean_method(
          @inputs["mean_stress_method"] || @inputs["meanStressMethod"] || "goodman",
        )

      surface =
        if calc_mode == "professional"
          optional_number("surface_factor", aliases: %w[surfaceFactor]) || 1.0
        else
          1.0
        end
      size =
        if calc_mode == "professional"
          optional_number("size_factor", aliases: %w[sizeFactor]) || 1.0
        else
          1.0
        end
      raise Error, I18n.t("mechbox.errors.positive_values_required") if surface <= 0 || size <= 0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "surface_factor") if surface > 1.0
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "size_factor") if size > 1.0

      adjusted_endurance = mat[:endurance_limit] * surface * size

      effective =
        if calc_mode == "professional" && mean_stress.positive?
          mean_stress_effective(raw_amplitude, mean_stress, mat, mean_method)
        else
          raw_amplitude
        end

      life =
        if !effective.finite? || effective <= 0
          nil
        elsif effective <= adjusted_endurance
          Float::INFINITY
        else
          life_from_stress(mat, effective, adjusted_endurance)
        end

      target_life =
        optional_number("target_life", aliases: %w[targetLife target_cycles]) || 1_000_000.0
      raise Error, I18n.t("mechbox.errors.positive_values_required") if target_life <= 0

      loads = parse_loads if calc_mode != "simple"
      miner =
        if calc_mode != "simple" && loads.present?
          miner_damage(
            mat,
            loads,
            endurance_factor: surface * size,
            mean_stress: calc_mode == "professional" ? mean_stress : nil,
            mean_method:,
          )
        end

      single_level_pass =
        if calc_mode == "simple" || life.nil?
          false
        else
          life.infinite? || life >= target_life
        end

      goodman_pass = nil
      if calc_mode == "professional" && mean_stress.positive? && effective.finite?
        goodman_pass = effective <= adjusted_endurance
        single_level_pass &&= goodman_pass
      end

      pass =
        if calc_mode == "simple"
          false
        elsif miner
          miner["pass"]
        else
          single_level_pass
        end

      # Professional without miner: also require goodman when mean stress applied.
      if calc_mode == "professional" && miner.nil? && !goodman_pass.nil?
        pass &&= goodman_pass
      end

      result = {
        "calc_mode" => calc_mode,
        "material" => material_key,
        "material_name" => mat[:name],
        "stress_amplitude_mpa" => round(raw_amplitude, 3),
        "effective_amplitude_mpa" => finite_or_nil(effective, 3),
        "endurance_limit_mpa" => round(mat[:endurance_limit], 2),
        "adjusted_endurance_mpa" => round(adjusted_endurance, 3),
        "life_cycles" => finite_or_nil(life, 0),
        "life_infinite" => life&.infinite? || false,
        "target_life" => round(target_life, 0),
        "single_level_pass" => single_level_pass,
        "pass" => pass,
        "estimate_only" => calc_mode == "simple",
        "sn_points" => sn_curve_points(mat),
      }

      if calc_mode == "professional"
        result["mean_stress_mpa"] = round(mean_stress, 3)
        result["mean_stress_method"] = mean_method
        result["surface_factor"] = round(surface, 3)
        result["size_factor"] = round(size, 3)
        result["goodman_pass"] = goodman_pass
      end

      result["miner"] = miner if miner
      result
    end

    private

    def mean_stress_effective(amplitude, mean, mat, method)
      return amplitude if amplitude <= 0
      return amplitude if mean <= 0

      denom = method == "soderberg" ? mat[:yield_min] : mat[:uts]
      return Float::INFINITY if mean >= denom

      amplitude / (1.0 - mean / denom)
    end

    def life_from_stress(mat, stress_amplitude, endurance_limit)
      return Float::INFINITY if stress_amplitude <= endurance_limit

      n = (stress_amplitude / mat[:sf])**(1.0 / mat[:b])
      [n, 1.0].max
    end

    def fatigue_strength(mat, cycles)
      n = [cycles, 1.0].max
      nref = mat[:cycle_limit]
      return mat[:endurance_limit] if n >= nref

      s = mat[:sf] * (n**mat[:b])
      [s, mat[:endurance_limit]].max
    end

    def sn_curve_points(mat, points = 12)
      nmin = 100.0
      nmax = 100_000_000.0
      (0..points).map do |i|
        log_n = Math.log10(nmin) + (i.to_f / points) * (Math.log10(nmax) - Math.log10(nmin))
        n = 10**log_n
        { "N" => n.round(0), "S" => round(fatigue_strength(mat, n), 2) }
      end
    end

    def miner_damage(mat, loads, endurance_factor:, mean_stress:, mean_method:)
      adjusted = mat[:endurance_limit] * endurance_factor
      damage = 0.0
      details = []
      infinite = false

      loads.each do |load|
        raw_sa = load[:stress].to_f
        n = load[:cycles].to_f
        next if raw_sa <= 0 || n <= 0

        sa_eff = raw_sa
        if mean_stress && mean_stress.positive?
          sa_eff = mean_stress_effective(raw_sa, mean_stress, mat, mean_method)
        end

        if !sa_eff.finite?
          infinite = true
          details << {
            "stress_mpa" => round(raw_sa, 2),
            "effective_stress_mpa" => nil,
            "cycles" => n.round(0),
            "life_cycles" => nil,
            "life_infinite" => false,
            "damage" => nil,
            "damage_infinite" => true,
          }
          next
        end
        next if sa_eff <= 0

        nf =
          if sa_eff <= adjusted
            Float::INFINITY
          else
            life_from_stress(mat, sa_eff, adjusted)
          end
        ni = nf.infinite? ? 0.0 : n / nf
        infinite = true if !ni.finite?
        damage += ni.finite? ? ni : 0.0
        details << {
          "stress_mpa" => round(raw_sa, 2),
          "effective_stress_mpa" => round(sa_eff, 2),
          "cycles" => n.round(0),
          "life_cycles" => nf.infinite? ? nil : nf.round(0),
          "life_infinite" => nf.infinite?,
          "damage" => ni.finite? ? round(ni, 6) : nil,
          "damage_infinite" => !ni.finite?,
        }
      end

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "loads_json") if details.empty?

      damage = Float::INFINITY if infinite
      if damage.finite? && damage.positive?
        details.each do |row|
          d = row["damage"]
          row["contribution_pct"] =
            d && damage.positive? ? round((d / damage) * 100.0, 2) : 0.0
        end
      end

      {
        "total_damage" => damage.finite? ? round(damage, 6) : nil,
        "damage_infinite" => !damage.finite?,
        "remaining_life_fraction" => damage.finite? ? round([0.0, 1.0 - damage].max, 6) : 0.0,
        "pass" => damage.finite? && damage < 1.0,
        "adjusted_endurance_mpa" => round(adjusted, 3),
        "details" => details,
      }
    end

    def parse_loads
      raw = @inputs["loads"] || @inputs["loads_json"] || @inputs["loadsJson"]
      return [] if raw.nil? || raw.to_s.strip.empty?

      list =
        case raw
        when Array
          raw
        when String
          begin
            parsed = JSON.parse(raw)
            parsed.is_a?(Array) ? parsed : parse_spectrum_text(raw)
          rescue JSON::ParserError
            parse_spectrum_text(raw)
          end
        else
          []
        end

      list.filter_map do |item|
        h = item.is_a?(Hash) ? item.transform_keys(&:to_s) : nil
        next unless h

        stress = h["stress"] || h["stress_mpa"] || h["stressAmplitude"]
        cycles = h["cycles"] || h["n"]
        next if stress.nil? || cycles.nil?

        { stress: Float(stress), cycles: Float(cycles) }
      rescue ArgumentError, TypeError
        nil
      end
    end

    def parse_spectrum_text(text)
      text
        .to_s
        .strip
        .split(/\n/)
        .filter_map do |line|
          parts = line.split(/[,，\s]+/).reject(&:empty?)
          next if parts.length < 2

          { "stress" => parts[0], "cycles" => parts[1] }
        end
    end

    def normalize_material(raw)
      key = raw.to_s
      return key if SN_MATERIALS.key?(key)

      "steel_45"
    end

    def normalize_mode(raw)
      mode = raw.to_s
      return mode if %w[simple full professional].include?(mode)
      return "full" if mode == "complete"

      "simple"
    end

    def normalize_mean_method(raw)
      method = raw.to_s.downcase
      return method if MEAN_METHODS.include?(method)

      "goodman"
    end

    def number_or_zero(key, aliases: [])
      optional_number(key, aliases:) || 0.0
    end

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? }
      return nil if raw.nil? || raw.to_s.strip.empty?

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def round(value, digits)
      value.round(digits)
    end

    def finite_or_nil(value, digits)
      return nil if value.nil? || !value.finite?

      digits.zero? ? value.round : value.round(digits)
    end
  end
end
