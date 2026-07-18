# frozen_string_literal: true

module DiscourseMechbox
  # Structural/flow pre-checks ported from MechBox structural utilities.
  # Units: pipe D mm, L m, Q L/min; plate/beam dimensions mm, stress MPa; modal E MPa.
  class StructuralCalculator
    class Error < StandardError
    end

    EDGE_CONDITIONS = {
      "ssss" => { label: "four edges simply supported", k: 4.0 },
      "cccc" => { label: "four edges fixed", k: 6.97 },
      "scsc" => { label: "opposite simply supported/opposite fixed", k: 6.74 },
      "sscc" => { label: "long edges simply supported/short edges fixed", k: 5.74 },
    }.freeze

    MODAL_CASES = %w[sdof beam_ss beam_cant].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      analysis_type = normalize_analysis_type(@inputs["analysis_type"] || @inputs["analysisType"])

      case analysis_type
      when "pipe_flow"
        calculate_pipe_flow(calc_mode)
      when "plate_buckling"
        calculate_plate_buckling(calc_mode)
      when "modal"
        calculate_modal(calc_mode)
      end
    end

    private

    def calculate_pipe_flow(calc_mode)
      diameter_m = positive_number("diameter_mm", aliases: %w[diameter]) / 1000.0
      length_m = positive_number("length_m", aliases: %w[length pipeLength])
      flow_rate_lpm = non_negative_number("flow_rate_lpm", aliases: %w[flowRate flow_rate])
      density = optional_positive_number("density_kg_m3", aliases: %w[density]) || 998.0
      viscosity = optional_positive_number("dynamic_viscosity_pa_s", aliases: %w[viscosity]) || 1.002e-3
      roughness_m = non_negative_number("roughness_mm", aliases: %w[roughness], default: 0.045) / 1000.0

      area_m2 = Math::PI * diameter_m**2 / 4.0
      flow_m3_s = flow_rate_lpm / 1000.0 / 60.0
      velocity = area_m2.positive? ? flow_m3_s / area_m2 : 0.0
      reynolds = density * velocity * diameter_m / viscosity
      friction_factor = pipe_friction_factor(reynolds, roughness_m, diameter_m)
      dynamic_head_pa = density * velocity**2 / 2.0
      pressure_drop_pa = friction_factor * (length_m / diameter_m) * dynamic_head_pa
      local_loss_k = calc_mode == "simple" ? 0.0 : non_negative_number("local_loss_k", aliases: %w[localLossK], default: 0.0)
      local_loss_pa = local_loss_k * dynamic_head_pa
      total_pressure_drop_pa = pressure_drop_pa + local_loss_pa

      result = {
        "calc_mode" => calc_mode,
        "analysis_type" => "pipe_flow",
        "diameter_mm" => round(diameter_m * 1000.0, 6),
        "length_m" => length_m,
        "flow_rate_lpm" => flow_rate_lpm,
        "velocity_mps" => round(velocity, 6),
        "reynolds" => round(reynolds, 3),
        "friction_factor" => round(friction_factor, 8),
        "pressure_drop_pa" => round(pressure_drop_pa, 6),
        "pressure_drop_kpa" => round(pressure_drop_pa / 1000.0, 6),
        "local_loss_k" => local_loss_k,
        "local_loss_pa" => round(local_loss_pa, 6),
        "total_pressure_drop_pa" => round(total_pressure_drop_pa, 6),
        "total_pressure_drop_kpa" => round(total_pressure_drop_pa / 1000.0, 6),
        "head_loss_m" => density.positive? ? round(total_pressure_drop_pa / (density * 9.81), 6) : nil,
        "flow_regime" => pipe_regime(reynolds),
      }

      if calc_mode != "simple"
        hazen_c = optional_positive_number("hazen_c", aliases: %w[hazenC]) || 130.0
        hazen = hazen_williams(diameter_m, length_m, flow_m3_s, hazen_c)
        result["hazen_williams"] = hazen
        result["method_compare"] = {
          "darcy_kpa" => result["total_pressure_drop_kpa"],
          "hazen_kpa" => hazen["pressure_drop_kpa"],
          "delta_percent" => round(((result["total_pressure_drop_kpa"] - hazen["pressure_drop_kpa"]).abs / [result["total_pressure_drop_kpa"], 0.01].max) * 100.0, 6),
          "water_only" => true,
        }
      end

      if calc_mode == "professional"
        max_velocity = optional_positive_number("max_velocity_mps", aliases: %w[maxVelocity]) || 3.0
        max_pressure_drop = optional_positive_number("max_pressure_drop_kpa", aliases: %w[maxPressureDropKPa]) || 200.0
        erosion_risk = if velocity > 5.0
          "high"
        elsif velocity > 3.0
          "medium"
        else
          "low"
        end
        result.merge!(
          "max_velocity_mps" => max_velocity,
          "max_pressure_drop_kpa" => max_pressure_drop,
          "velocity_pass" => velocity <= max_velocity,
          "pressure_pass" => result["total_pressure_drop_kpa"] <= max_pressure_drop,
          "erosion_risk" => erosion_risk,
        )
        result["pass"] = result["velocity_pass"] && result["pressure_pass"]
      end

      result
    end

    def calculate_plate_buckling(calc_mode)
      elastic_modulus = optional_positive_number("elastic_modulus_mpa", aliases: %w[elasticModulus]) || 210_000.0
      poisson = optional_number("poisson") || 0.3
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "poisson") if poisson <= -1.0 || poisson >= 0.5

      thickness = positive_number("thickness_mm", aliases: %w[thickness])
      width = positive_number("width_mm", aliases: %w[width])
      length = positive_number("length_mm", aliases: %w[length])
      edge = EDGE_CONDITIONS[(@inputs["edge_condition"] || @inputs["edgeCondition"] || "ssss").to_s]
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "edge_condition") if edge.nil?

      aspect_ratio = length / width
      k = edge[:k]
      k *= 1.0 + 0.1 * [aspect_ratio - 1.0, 2.0].min if aspect_ratio > 1.0

      if calc_mode != "simple"
        imperfection = optional_positive_number("imperfection_factor", aliases: %w[imperfectionFactor]) || 0.8
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "imperfection_factor") if imperfection > 1.0
        k *= imperfection
      else
        imperfection = nil
      end

      critical_stress = (k * Math::PI**2 * elastic_modulus / (12.0 * (1.0 - poisson**2))) * (thickness / width)**2
      applied = non_negative_number("applied_stress_mpa", aliases: %w[appliedStress], default: 0.0)
      applied_transverse = calc_mode == "simple" ? 0.0 : non_negative_number("applied_stress_transverse_mpa", aliases: %w[appliedStressTransverse], default: 0.0)
      combined = applied + 0.5 * applied_transverse
      min_safety = optional_positive_number("min_safety", aliases: %w[minSafety]) || 2.0
      safety_factor = combined.positive? ? critical_stress / combined : nil

      result = {
        "calc_mode" => calc_mode,
        "analysis_type" => "plate_buckling",
        "thickness_mm" => thickness,
        "width_mm" => width,
        "length_mm" => length,
        "aspect_ratio" => round(aspect_ratio, 6),
        "edge_condition" => (@inputs["edge_condition"] || @inputs["edgeCondition"] || "ssss").to_s,
        "edge_condition_label" => edge[:label],
        "buckling_coefficient" => round(k, 6),
        "critical_stress_mpa" => round(critical_stress, 6),
        "applied_stress_mpa" => applied,
        "safety_factor" => safety_factor.nil? ? nil : round(safety_factor, 6),
        "min_safety" => min_safety,
        "pass" => combined <= 0.0 || safety_factor >= min_safety,
        "flexural_rigidity_nmm" => round((elastic_modulus * thickness**3) / (12.0 * (1.0 - poisson**2)), 6),
      }

      if calc_mode != "simple"
        result.merge!(
          "applied_stress_transverse_mpa" => applied_transverse,
          "combined_applied_stress_mpa" => combined,
          "imperfection_factor" => imperfection,
          "utilization" => critical_stress.positive? ? round(combined / critical_stress, 6) : nil,
        )
      end

      if calc_mode == "professional"
        post_buckling_factor = optional_positive_number("post_buckling_factor", aliases: %w[postBucklingFactor]) || 1.5
        shear_stress = non_negative_number("applied_shear_mpa", aliases: %w[appliedShear], default: 0.0)
        result["post_buckling_factor"] = post_buckling_factor
        result["post_buckling_reserve_mpa"] = round(critical_stress * post_buckling_factor, 6)
        result["applied_shear_mpa"] = shear_stress
        if shear_stress.positive?
          critical_shear = 0.3 * critical_stress
          result["critical_shear_mpa"] = round(critical_shear, 6)
          result["shear_pass"] = shear_stress <= critical_shear / min_safety
          result["pass"] = result["pass"] && result["shear_pass"]
        end
      end

      result
    end

    def calculate_modal(calc_mode)
      case_id = (@inputs["case_id"] || @inputs["caseId"] || "sdof").to_s
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "case_id") unless MODAL_CASES.include?(case_id)

      modal =
        case case_id
        when "sdof" then sdof_frequency
        when "beam_ss" then simply_supported_beam_frequency
        when "beam_cant" then cantilever_beam_frequency
        end
      excitation = optional_non_negative_number("excitation_freq_hz", aliases: %w[excitationFreq])
      resonance = excitation && excitation.positive? ? resonance_margin(modal["fn_hz"], excitation) : nil

      result = { "calc_mode" => calc_mode, "analysis_type" => "modal", "case_id" => case_id, "modal" => modal, "resonance" => resonance }
      if calc_mode != "simple"
        result["critical_speed_rpm"] = round(modal["fn_hz"] * 60.0, 6)
        rpm = optional_non_negative_number("rpm")
        result["operating_resonance"] = resonance_margin(modal["fn_hz"], rpm / 60.0) if rpm && rpm.positive?
      end
      if calc_mode == "professional"
        damping = optional_positive_number("damping_ratio", aliases: %w[dampingRatio]) || 0.02
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "damping_ratio") if damping >= 1.0
        ratio = resonance ? resonance["frequency_ratio"] : 1.0
        result["damping_ratio"] = damping
        result["amplification_factor"] = round(1.0 / Math.sqrt((1.0 - ratio**2)**2 + (2.0 * damping * ratio)**2), 6)
        result["pass"] = resonance ? resonance["pass"] : true
      end
      result
    end

    def sdof_frequency
      stiffness = positive_number("stiffness_n_m", aliases: %w[stiffness])
      mass = positive_number("mass_kg", aliases: %w[mass])
      omega = Math.sqrt(stiffness / mass)
      { "omega_rad_s" => round(omega, 6), "fn_hz" => round(omega / (2.0 * Math::PI), 6), "period_s" => round((2.0 * Math::PI) / omega, 6), "mode_key" => "sdof" }
    end

    def simply_supported_beam_frequency
      elastic_modulus = optional_positive_number("elastic_modulus_mpa", aliases: %w[elasticModulus]) || 210_000.0
      density = optional_positive_number("density_kg_m3", aliases: %w[density]) || 7850.0
      span = positive_number("span_length_mm", aliases: %w[spanLength])
      diameter = positive_number("diameter_mm", aliases: %w[diameter])
      inertia = Math::PI * diameter**4 / 64.0
      area = Math::PI * diameter**2 / 4.0
      rho = density * 1e-9
      fn = (Math::PI / (2.0 * span**2)) * Math.sqrt((elastic_modulus * inertia) / (rho * area))
      { "fn_hz" => round(fn, 6), "span_length_mm" => span, "diameter_mm" => diameter, "inertia_mm4" => round(inertia, 6), "mode_key" => "beam_ss" }
    end

    def cantilever_beam_frequency
      elastic_modulus = optional_positive_number("elastic_modulus_mpa", aliases: %w[elasticModulus]) || 210_000.0
      density = optional_positive_number("density_kg_m3", aliases: %w[density]) || 7850.0
      span = positive_number("span_length_mm", aliases: %w[spanLength])
      diameter = positive_number("diameter_mm", aliases: %w[diameter])
      inertia = Math::PI * diameter**4 / 64.0
      area = Math::PI * diameter**2 / 4.0
      rho = density * 1e-9
      lambda1 = 1.875
      fn = (lambda1**2 / (2.0 * Math::PI * span**2)) * Math.sqrt((elastic_modulus * inertia) / (rho * area))
      { "fn_hz" => round(fn, 6), "span_length_mm" => span, "diameter_mm" => diameter, "mode_key" => "beam_cant" }
    end

    def resonance_margin(natural_hz, excitation_hz)
      delta = (excitation_hz - natural_hz).abs
      margin = delta / natural_hz
      assessment = margin < 0.1 ? "danger" : margin < 0.2 ? "warn" : "safe"
      { "natural_freq_hz" => natural_hz, "excitation_freq_hz" => excitation_hz, "margin" => round(margin, 6), "margin_percent" => round(margin * 100.0, 6), "frequency_ratio" => round(excitation_hz / natural_hz, 6), "assessment" => assessment, "pass" => margin >= 0.2 }
    end

    def pipe_friction_factor(reynolds, roughness_m, diameter_m)
      return 64.0 / [reynolds, 1.0].max if reynolds < 2300.0

      term = roughness_m / diameter_m / 3.7 + 5.74 / reynolds**0.9
      0.25 / Math.log10(term)**2
    end

    def pipe_regime(reynolds)
      return "laminar" if reynolds < 2300.0
      return "transition" if reynolds < 4000.0

      "turbulent"
    end

    def hazen_williams(diameter_m, length_m, flow_m3_s, coefficient)
      area = Math::PI * diameter_m**2 / 4.0
      velocity = area.positive? ? flow_m3_s / area : 0.0
      head_loss = 10.67 * length_m * flow_m3_s**1.852 / (coefficient**1.852 * diameter_m**4.871)
      { "head_loss_m" => round(head_loss, 6), "velocity_mps" => round(velocity, 6), "pressure_drop_kpa" => round(head_loss * 9.81, 6) }
    end

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def normalize_analysis_type(raw)
      value = raw.to_s.presence || "pipe_flow"
      return "pipe_flow" if value == "pipe" || value == "pipe_flow"
      return "plate_buckling" if value == "plate" || value == "plate_buckling"
      return "modal" if value == "modal"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "analysis_type")
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