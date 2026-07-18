# frozen_string_literal: true

module DiscourseMechbox
  # Spur gear strength: Lewis (simple), ISO 6336 simplified (full),
  # ISO + AGMA 2101 compare (professional).
  # Ported from MechBox gear-calc.js / gear-iso6336.js / gear-agma.js.
  class GearCalculator
    class Error < StandardError
    end

    ZE_STEEL = 189.8
    CP_STEEL = 190.0
    DEG = Math::PI / 180.0

    MATERIALS = {
      "st-soft" => { name: "调质钢(软齿面)", sigma_hlim: 750.0, sigma_flim: 320.0 },
      "st-hard" => { name: "调质钢(硬齿面)", sigma_hlim: 1200.0, sigma_flim: 450.0 },
      "case-carburized" => { name: "渗碳淬火钢", sigma_hlim: 1500.0, sigma_flim: 550.0 },
      "nitrided" => { name: "氮化钢", sigma_hlim: 1300.0, sigma_flim: 420.0 },
      "gg" => { name: "灰铸铁 GG", sigma_hlim: 500.0, sigma_flim: 140.0 },
      "ggg" => { name: "球墨铸铁 GGG", sigma_hlim: 780.0, sigma_flim: 280.0 },
    }.freeze

    YF_TABLE = [
      [17, 2.97], [18, 2.91], [19, 2.85], [20, 2.8], [22, 2.72], [24, 2.65],
      [25, 2.62], [26, 2.6], [28, 2.55], [30, 2.52], [35, 2.45], [40, 2.4],
      [45, 2.35], [50, 2.32], [60, 2.28], [80, 2.22], [100, 2.18], [150, 2.12],
      [200, 2.08],
    ].freeze

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      module_mm = positive_number("module_mm", aliases: %w[module])
      pinion_teeth =
        positive_number("pinion_teeth", aliases: %w[pinionTeeth teeth]).round
      raise Error, I18n.t("mechbox.errors.positive_values_required") if pinion_teeth < 12

      gear_teeth =
        optional_number("gear_teeth", aliases: %w[gearTeeth])&.round ||
          (pinion_teeth * (optional_number("gear_ratio", aliases: %w[gearRatio]) || 3.0)).round
      raise Error, I18n.t("mechbox.errors.positive_values_required") if gear_teeth < 12

      face_width = positive_number("face_width_mm", aliases: %w[faceWidth face_width])
      torque = number_or_zero("torque_nm", aliases: %w[torque])
      raise Error, I18n.t("mechbox.errors.positive_values_required") if torque < 0

      rpm = number_or_zero("rpm", aliases: %w[speed_rpm])
      raise Error, I18n.t("mechbox.errors.positive_values_required") if rpm < 0

      pressure_angle =
        optional_number("pressure_angle_deg", aliases: %w[pressureAngle]) || 20.0
      helix_angle =
        if calc_mode == "simple"
          0.0
        else
          optional_number("helix_angle_deg", aliases: %w[helixAngle]) || 0.0
        end

      case calc_mode
      when "simple"
        calculate_simple(
          module_mm:,
          pinion_teeth:,
          gear_teeth:,
          face_width:,
          torque:,
          rpm:,
          pressure_angle:,
        )
      when "full"
        calculate_iso(
          calc_mode:,
          module_mm:,
          pinion_teeth:,
          gear_teeth:,
          face_width:,
          torque:,
          rpm:,
          pressure_angle:,
          helix_angle:,
        )
      else
        iso =
          calculate_iso(
            calc_mode: "professional",
            module_mm:,
            pinion_teeth:,
            gear_teeth:,
            face_width:,
            torque:,
            rpm:,
            pressure_angle:,
            helix_angle:,
          )
        agma =
          calculate_agma(
            module_mm:,
            pinion_teeth:,
            gear_teeth:,
            face_width:,
            torque:,
            rpm:,
            pressure_angle:,
          )
        compare = compare_standards(iso, agma)
        iso.merge(
          "agma" => agma,
          "compare" => compare,
          "pass" => compare["both_pass"],
          "standard" => "ISO6336+AGMA",
        )
      end
    end

    private

    def calculate_simple(module_mm:, pinion_teeth:, gear_teeth:, face_width:, torque:, rpm:, pressure_angle:)
      u = gear_teeth.to_f / pinion_teeth
      d1 = module_mm * pinion_teeth
      force = tangential_force(torque, d1)
      form_factor =
        optional_number("form_factor", aliases: %w[formFactor]) || lookup_yf(pinion_teeth)
      sigma_f = bending_stress_lewis(force, face_width, module_mm, form_factor)
      sigma_h = contact_stress_lewis(force, face_width, d1, u)
      velocity = pitch_line_velocity(d1, rpm)

      mat = material_for(@inputs["material"] || @inputs["pinion_material"] || "st-soft")
      bending_sf = optional_number("bending_safety_factor") || 1.4
      contact_sf = optional_number("contact_safety_factor") || 1.2
      allow_bend =
        optional_number("allow_bending_mpa", aliases: %w[allowBending]) ||
          (mat[:sigma_flim] / bending_sf)
      allow_contact =
        optional_number("allow_contact_mpa", aliases: %w[allowContact]) ||
          (mat[:sigma_hlim] / contact_sf)

      bending_pass = sigma_f <= allow_bend
      contact_pass = sigma_h <= allow_contact

      {
        "calc_mode" => "simple",
        "standard" => "Lewis",
        "module_mm" => round(module_mm, 3),
        "pinion_teeth" => pinion_teeth,
        "gear_teeth" => gear_teeth,
        "gear_ratio" => round(u, 4),
        "pitch_diameter_mm" => round(d1, 3),
        "base_diameter_mm" => round(d1 * Math.cos(pressure_angle * DEG), 3),
        "tangential_force_n" => round(force, 2),
        "bending_stress_mpa" => round(sigma_f, 3),
        "contact_stress_mpa" => round(sigma_h, 3),
        "pitch_line_velocity_mps" => round(velocity, 4),
        "form_factor" => round(form_factor, 3),
        "allow_bending_mpa" => round(allow_bend, 2),
        "allow_contact_mpa" => round(allow_contact, 2),
        "material" => mat[:id],
        "material_name" => mat[:name],
        "bending_pass" => bending_pass,
        "contact_pass" => contact_pass,
        "pass" => false,
        "estimate_only" => true,
      }
    end

    def calculate_iso(
      calc_mode:,
      module_mm:,
      pinion_teeth:,
      gear_teeth:,
      face_width:,
      torque:,
      rpm:,
      pressure_angle:,
      helix_angle:
    )
      u = gear_teeth.to_f / pinion_teeth
      x1 = optional_number("profile_shift_pinion", aliases: %w[profileShiftPinion]) || 0.0
      x2 = optional_number("profile_shift_gear", aliases: %w[profileShiftGear]) || 0.0
      d1 = module_mm * (pinion_teeth + 2 * x1)
      d2 = module_mm * (gear_teeth + 2 * x2)

      force = tangential_force(torque, d1)
      velocity = pitch_line_velocity(d1, rpm)
      epsilon =
        contact_ratio(
          module_mm:,
          z1: pinion_teeth,
          z2: gear_teeth,
          pressure_angle:,
        )

      ka = optional_number("application_factor", aliases: %w[applicationFactor KA]) || 1.25
      grade =
        (
          optional_number("iso1328_grade", aliases: %w[iso1328Grade accuracyGrade]) || 6
        ).round
      kv =
        optional_number("dynamic_factor", aliases: %w[dynamicFactor KV]) ||
          iso1328_kv(module_mm, d1, face_width, grade, velocity)

      kh_beta = optional_number("face_load_factor_h", aliases: %w[faceLoadFactorH]) || 1.1
      kh_alpha = optional_number("transverse_load_factor_h") || 1.0
      kf_beta = optional_number("face_load_factor_f", aliases: %w[faceLoadFactorF]) || 1.1
      kf_alpha = optional_number("transverse_load_factor_f") || 1.0

      zh = calc_zh(pressure_angle, helix_angle)
      z_eps = Math.sqrt((4.0 - epsilon) / 3.0)
      z_beta = Math.sqrt(Math.cos(helix_angle * DEG))
      zb = calc_zb(u)
      yf = lookup_yf(pinion_teeth)
      ys = calc_ys(pinion_teeth)
      y_beta = helix_angle > 0 ? 1.0 - (0.25 * helix_angle) / 120.0 : 1.0
      y_dt = helix_angle > 0 ? 1.0 - 0.25 * (helix_angle / 30.0) : 1.0

      load_term = (force / (face_width * d1)) * ((u + 1.0) / u)
      factor = zb * zh * ZE_STEEL * z_eps * z_beta
      sigma_h = factor * Math.sqrt(load_term * ka * kv * kh_beta * kh_alpha)

      sigma_f =
        (force / (face_width * module_mm)) * yf * ys * y_beta * y_dt * ka * kv * kf_beta *
          kf_alpha

      mat_p = material_for(@inputs["pinion_material"] || @inputs["pinionMaterial"] || "st-soft")
      mat_g = material_for(@inputs["gear_material"] || @inputs["gearMaterial"] || "st-soft")
      sigma_hlim = [mat_p[:sigma_hlim], mat_g[:sigma_hlim]].min
      sigma_flim = [mat_p[:sigma_flim], mat_g[:sigma_flim]].min

      sh_min = optional_number("min_safety_contact", aliases: %w[minSafetyContact]) || 1.0
      sf_min = optional_number("min_safety_bending", aliases: %w[minSafetyBending]) || 1.4
      sh = sigma_h > 0 ? sigma_hlim / sigma_h : Float::INFINITY
      sf = sigma_f > 0 ? sigma_flim / sigma_f : Float::INFINITY
      contact_pass = sh >= sh_min
      bending_pass = sf >= sf_min

      {
        "calc_mode" => calc_mode,
        "standard" => "ISO6336",
        "module_mm" => round(module_mm, 3),
        "pinion_teeth" => pinion_teeth,
        "gear_teeth" => gear_teeth,
        "gear_ratio" => round(u, 4),
        "pitch_diameter_1_mm" => round(d1, 3),
        "pitch_diameter_2_mm" => round(d2, 3),
        "contact_ratio" => round(epsilon, 4),
        "tangential_force_n" => round(force, 2),
        "pitch_line_velocity_mps" => round(velocity, 4),
        "bending_stress_mpa" => round(sigma_f, 3),
        "contact_stress_mpa" => round(sigma_h, 3),
        "sigma_hlim_mpa" => round(sigma_hlim, 1),
        "sigma_flim_mpa" => round(sigma_flim, 1),
        "safety_contact" => finite_or_nil(sh, 3),
        "safety_bending" => finite_or_nil(sf, 3),
        "min_safety_contact" => sh_min,
        "min_safety_bending" => sf_min,
        "bending_pass" => bending_pass,
        "contact_pass" => contact_pass,
        "pass" => bending_pass && contact_pass,
        "estimate_only" => false,
        "pinion_material" => mat_p[:id],
        "gear_material" => mat_g[:id],
        "factors" => {
          "YF" => round(yf, 3),
          "YS" => round(ys, 3),
          "ZH" => round(zh, 3),
          "ZE" => ZE_STEEL,
          "Zepsilon" => round(z_eps, 3),
          "Zbeta" => round(z_beta, 3),
          "ZB" => round(zb, 3),
          "KA" => round(ka, 3),
          "KV" => round(kv, 3),
          "iso1328_grade" => grade,
        },
      }
    end

    def calculate_agma(module_mm:, pinion_teeth:, gear_teeth:, face_width:, torque:, rpm:, pressure_angle:)
      u = gear_teeth.to_f / pinion_teeth
      d1 = module_mm * pinion_teeth
      force = tangential_force(torque, d1)
      velocity = pitch_line_velocity(d1, rpm)

      ko = optional_number("application_factor", aliases: %w[applicationFactor]) || 1.25
      km = optional_number("load_distribution_factor", aliases: %w[loadDistributionFactor]) || 1.2
      ks = size_factor_ks(module_mm)
      grade =
        (
          optional_number("iso1328_grade", aliases: %w[iso1328Grade qualityGrade]) || 6
        ).round
      kv =
        optional_number("dynamic_factor", aliases: %w[dynamicFactor]) ||
          iso1328_kv(module_mm, d1, face_width, grade, velocity)

      i_factor = geometry_factor_i(pinion_teeth, gear_teeth, pressure_angle)
      j_factor = geometry_factor_j(pinion_teeth, pressure_angle)

      contact =
        CP_STEEL *
          Math.sqrt(((force * ko * kv * km) / (face_width * d1 * i_factor)) * ((u + 1.0) / u))
      bending = (force * ko * kv * km * ks) / (face_width * module_mm * j_factor)

      mat_p = material_for(@inputs["pinion_material"] || @inputs["pinionMaterial"] || "st-soft")
      mat_g = material_for(@inputs["gear_material"] || @inputs["gearMaterial"] || "st-soft")
      sac = [mat_p[:sigma_hlim], mat_g[:sigma_hlim]].min
      sat = [mat_p[:sigma_flim], mat_g[:sigma_flim]].min
      sh_min = optional_number("min_safety_contact", aliases: %w[minSafetyContact]) || 1.0
      sf_min = optional_number("min_safety_bending", aliases: %w[minSafetyBending]) || 1.4
      sh = contact > 0 ? sac / contact : Float::INFINITY
      sf = bending > 0 ? sat / bending : Float::INFINITY

      {
        "standard" => "AGMA2101",
        "tangential_force_n" => round(force, 2),
        "pitch_line_velocity_mps" => round(velocity, 4),
        "contact_stress_mpa" => round(contact, 3),
        "bending_stress_mpa" => round(bending, 3),
        "safety_contact" => finite_or_nil(sh, 3),
        "safety_bending" => finite_or_nil(sf, 3),
        "contact_pass" => sh >= sh_min,
        "bending_pass" => sf >= sf_min,
        "factors" => {
          "Cp" => CP_STEEL,
          "Ko" => round(ko, 3),
          "Kv" => round(kv, 3),
          "Km" => round(km, 3),
          "Ks" => round(ks, 3),
          "I" => round(i_factor, 4),
          "J" => round(j_factor, 4),
        },
      }
    end

    def compare_standards(iso, agma)
      iso_h = iso["contact_stress_mpa"].to_f
      agma_h = agma["contact_stress_mpa"].to_f
      iso_f = iso["bending_stress_mpa"].to_f
      agma_f = agma["bending_stress_mpa"].to_f
      {
        "contact_stress_diff_pct" =>
          iso_h.positive? ? round(((agma_h - iso_h) / iso_h) * 100.0, 2) : nil,
        "bending_stress_diff_pct" =>
          iso_f.positive? ? round(((agma_f - iso_f) / iso_f) * 100.0, 2) : nil,
        "both_pass" =>
          iso["contact_pass"] && iso["bending_pass"] && agma["contact_pass"] &&
            agma["bending_pass"],
      }
    end

    def tangential_force(torque_nm, pitch_diameter_mm)
      return 0.0 if pitch_diameter_mm <= 0

      (2000.0 * torque_nm) / pitch_diameter_mm
    end

    def pitch_line_velocity(pitch_diameter_mm, rpm)
      (Math::PI * pitch_diameter_mm * rpm) / 60_000.0
    end

    def bending_stress_lewis(force, face_width, module_mm, form_factor)
      denom = face_width * module_mm * form_factor
      return 0.0 if denom <= 0

      force / denom
    end

    def contact_stress_lewis(force, face_width, pitch_diameter, gear_ratio)
      u = [gear_ratio, 1.0].max
      denom = face_width * pitch_diameter * u
      return 0.0 if denom <= 0 || force <= 0

      118.0 * Math.sqrt((force * (u + 1.0)) / denom)
    end

    def contact_ratio(module_mm:, z1:, z2:, pressure_angle:)
      alpha = pressure_angle * DEG
      d1 = module_mm * z1
      d2 = module_mm * z2
      db1 = d1 * Math.cos(alpha)
      db2 = d2 * Math.cos(alpha)
      da1 = d1 + 2 * module_mm
      da2 = d2 + 2 * module_mm
      a = (d1 + d2) / 2.0
      term1 = Math.sqrt([0.0, (da1 / 2.0)**2 - (db1 / 2.0)**2].max)
      term2 = Math.sqrt([0.0, (da2 / 2.0)**2 - (db2 / 2.0)**2].max)
      eps = (term1 + term2 - a * Math.sin(alpha)) / (Math::PI * module_mm * Math.cos(alpha))
      [[eps, 1.0].max, 1.8].min
    end

    def calc_zh(pressure_angle, helix_angle)
      alpha_t = pressure_angle * DEG
      beta_b = helix_angle * DEG
      (2.0 * Math.cos(beta_b)) / Math.sqrt(Math.sin(alpha_t) * Math.cos(alpha_t))
    end

    def calc_zb(u)
      return 1.0 if u < 1.2
      return 1.07 if u >= 8

      1.0 + 0.07 * ((u - 1.2) / 6.8)
    end

    def lookup_yf(z)
      teeth = [z.to_f, 17.0].max
      return YF_TABLE.first[1] if teeth <= YF_TABLE.first[0]

      YF_TABLE.each_cons(2) do |(z0, y0), (z1, y1)|
        if teeth >= z0 && teeth <= z1
          t = (teeth - z0) / (z1 - z0)
          return y0 + t * (y1 - y0)
        end
      end
      YF_TABLE.last[1]
    end

    def calc_ys(z)
      return 2.0 if z < 40

      1.6 + 0.4 * ((40.0 / z)**3)
    end

    def iso1328_kv(module_mm, pitch_diameter, face_width, grade, velocity)
      k = 2**((grade - 6) / 2.0)
      fpt = (0.42 * Math.sqrt(module_mm) + 0.12 * Math.sqrt(pitch_diameter)) * k
      ff = (0.38 * Math.sqrt(module_mm) + 0.1 * Math.sqrt(pitch_diameter)) * k
      tol_factor = Math.sqrt((fpt * ff) / 100.0)
      grade_factor = [1.0, (10 - grade) * 0.035].max
      speed_factor = 1.0 + [0.6, velocity / 40.0].min
      kv = 1.0 + grade_factor * speed_factor * 0.12 + tol_factor * 0.008
      [[kv, 1.0].max, 2.0].min
    end

    def size_factor_ks(module_mm)
      return 0.85 if module_mm >= 5
      return 0.95 if module_mm >= 2

      1.0
    end

    def geometry_factor_i(z1, z2, pressure_angle)
      u = z2.to_f / z1
      alpha = pressure_angle * DEG
      base = 0.35 + 0.25 / Math.sqrt(u)
      angle_adj = 1.0 + (20.0 - pressure_angle) * 0.005
      [0.08, base * angle_adj * Math.sqrt(Math.cos(alpha))].max
    end

    def geometry_factor_j(z1, pressure_angle)
      y = lookup_yf(z1)
      ys = calc_ys(z1)
      r = 0.5 * (1.0 - Math.sin(pressure_angle * DEG))
      [0.05, y * ys * r * 0.04].max
    end

    def material_for(raw)
      key = raw.to_s
      mat = MATERIALS[key] || MATERIALS["st-soft"]
      mat.merge(id: MATERIALS.key?(key) ? key : "st-soft")
    end

    def normalize_mode(raw)
      mode = raw.to_s
      return mode if %w[simple full professional].include?(mode)
      return "full" if mode == "complete"

      "simple"
    end

    def positive_number(key, aliases: [])
      value = optional_number(key, aliases:)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value.nil? || value <= 0

      value
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
      return nil unless value.finite?

      round(value, digits)
    end
  end
end
