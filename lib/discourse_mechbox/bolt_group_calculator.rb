# frozen_string_literal: true

module DiscourseMechbox
  # Bolt group eccentric load sharing.
  # Ported from MechBox/src/utils/bolt-group-calc.js
  class BoltGroupCalculator
    class Error < StandardError
    end

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"])
      bolt_count = positive_integer("bolt_count", aliases: %w[boltCount], min: 2, max: 24)
      radius = positive_number("bolt_circle_radius_mm", aliases: %w[bolt_circle_radius boltCircleRadius])
      shear_x = number_or_zero("shear_x_n", aliases: %w[shear_x shearX])
      shear_y = number_or_zero("shear_y_n", aliases: %w[shear_y shearY])
      moment = number_or_zero("moment_nmm", aliases: %w[moment moment_nm])
      allow_shear = optional_number("allow_per_bolt_n", aliases: %w[allow_per_bolt allowPerBolt]) || 8000.0
      allow_tension =
        optional_number("allow_tension_per_bolt_n", aliases: %w[allow_tension_per_bolt allowTensionPerBolt]) ||
          allow_shear

      raise Error, I18n.t("mechbox.errors.positive_values_required") if allow_shear <= 0 || allow_tension <= 0

      if calc_mode == "simple"
        return calculate_simple(
                 calc_mode:,
                 bolt_count:,
                 radius:,
                 shear_x:,
                 shear_y:,
                 moment:,
                 allow_shear:,
               )
      end

      calculate_complete(
        calc_mode:,
        bolt_count:,
        radius:,
        shear_x:,
        shear_y:,
        moment:,
        allow_shear:,
        allow_tension:,
      )
    end

    private

    def calculate_simple(calc_mode:, bolt_count:, radius:, shear_x:, shear_y:, moment:, allow_shear:)
      r_max = radius
      polar = bolt_count * (r_max**2)
      direct = Math.sqrt(shear_x**2 + shear_y**2) / bolt_count
      torsion = polar.positive? ? (moment * r_max) / polar : 0.0
      max_force = direct + torsion
      force_pass = max_force <= allow_shear

      {
        "calc_mode" => calc_mode,
        "bolt_count" => bolt_count,
        "bolt_circle_radius_mm" => radius,
        "shear_x_n" => shear_x,
        "shear_y_n" => shear_y,
        "moment_nmm" => moment,
        "direct_per_bolt_n" => direct,
        "torsion_per_bolt_n" => torsion,
        "max_bolt_force_n" => max_force,
        "allow_per_bolt_n" => allow_shear,
        "force_pass" => force_pass,
        "pass" => false,
        "estimate_only" => true,
      }
    end

    def calculate_complete(
      calc_mode:,
      bolt_count:,
      radius:,
      shear_x:,
      shear_y:,
      moment:,
      allow_shear:,
      allow_tension:
    )
      positions = generate_circle_positions(bolt_count, radius)
      polar = positions.sum { |p| p[:x]**2 + p[:y]**2 }
      raise Error, I18n.t("mechbox.errors.invalid_input", field: "bolt_count") if polar <= 0

      axial = number_or_zero("axial_tension_n", aliases: %w[axial_tension axialTension])
      prying_arm = number_or_zero("prying_arm_mm", aliases: %w[prying_arm pryingArm])
      prying = calc_prying(bolt_count:, moment:, axial:, prying_arm:)
      tension_per_bolt = prying["total_tension_n"]

      bolts =
        positions.map.with_index(1) do |p, index|
          fx = shear_x / bolt_count - (moment * p[:y]) / polar
          fy = shear_y / bolt_count + (moment * p[:x]) / polar
          shear = Math.sqrt(fx**2 + fy**2)
          combined = Math.sqrt(shear**2 + tension_per_bolt**2)
          interaction = assess_interaction(shear, tension_per_bolt, allow_shear, allow_tension)

          {
            "index" => index,
            "x_mm" => round(p[:x], 2),
            "y_mm" => round(p[:y], 2),
            "fx_n" => round(fx, 1),
            "fy_n" => round(fy, 1),
            "shear_force_n" => round(shear, 1),
            "tension_force_n" => round(tension_per_bolt, 1),
            "combined_force_n" => round(combined, 1),
            "pass" => interaction[:pass],
            "utilization" => round(interaction[:utilization], 4),
          }
        end

      max_bolt = bolts.max_by { |b| b["combined_force_n"] }
      direct = Math.sqrt(shear_x**2 + shear_y**2) / bolt_count
      torsion = [0.0, max_bolt["shear_force_n"] - direct].max
      shear_resultant = Math.sqrt(shear_x**2 + shear_y**2)

      friction = nil
      friction_coeff = number_or_zero("friction_coeff", aliases: %w[frictionCoeff])
      clamp = number_or_zero("clamp_force_per_bolt_n", aliases: %w[clamp_force_per_bolt clampForcePerBolt])
      if friction_coeff.positive? && clamp.positive?
        slip_capacity = friction_coeff * clamp * bolt_count
        slip_pass = shear_resultant <= slip_capacity
        friction = {
          "friction_coeff" => friction_coeff,
          "clamp_force_per_bolt_n" => clamp,
          "clamp_force_total_n" => clamp * bolt_count,
          "slip_capacity_n" => slip_capacity,
          "shear_resultant_n" => shear_resultant,
          "slip_pass" => slip_pass,
          "slip_utilization" => slip_capacity.positive? ? shear_resultant / slip_capacity : 0.0,
        }
      end

      shear_pass = bolts.all? { |b| b["shear_force_n"] <= allow_shear }
      interaction_pass = bolts.all? { |b| b["pass"] }
      slip_pass = friction ? friction["slip_pass"] : true

      {
        "calc_mode" => calc_mode,
        "bolt_count" => bolt_count,
        "bolt_circle_radius_mm" => radius,
        "shear_x_n" => shear_x,
        "shear_y_n" => shear_y,
        "moment_nmm" => moment,
        "direct_per_bolt_n" => direct,
        "torsion_per_bolt_n" => torsion,
        "max_bolt_force_n" => max_bolt["combined_force_n"],
        "max_shear_force_n" => max_bolt["shear_force_n"],
        "critical_bolt_index" => max_bolt["index"],
        "allow_per_bolt_n" => allow_shear,
        "allow_tension_per_bolt_n" => allow_tension,
        "polar_inertia_mm2" => polar,
        "bolts" => bolts,
        "prying" => prying,
        "friction" => friction,
        "shear_pass" => shear_pass,
        "interaction_pass" => interaction_pass,
        "slip_pass" => slip_pass,
        "pass" => shear_pass && interaction_pass && slip_pass,
        "estimate_only" => false,
      }
    end

    def generate_circle_positions(count, radius)
      count.times.map do |i|
        angle = (2.0 * Math::PI * i) / count
        { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
      end
    end

    def calc_prying(bolt_count:, moment:, axial:, prying_arm:)
      direct = axial / bolt_count
      prying_tension = moment.positive? && prying_arm.positive? ? moment / (bolt_count * prying_arm) : 0.0
      {
        "direct_tension_n" => direct,
        "prying_tension_n" => prying_tension,
        "total_tension_n" => direct + prying_tension,
      }
    end

    def assess_interaction(shear, tension, allow_shear, allow_tension)
      vs = allow_shear.positive? ? shear / allow_shear : 0.0
      ts = allow_tension.positive? ? tension / allow_tension : 0.0
      utilization = Math.sqrt(vs**2 + ts**2)
      { utilization:, pass: utilization <= 1.0 }
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

    def positive_integer(key, aliases: [], min: 1, max: nil)
      value = (optional_number(key, aliases:) || min).round
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value < min
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if max && value > max
      value
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
