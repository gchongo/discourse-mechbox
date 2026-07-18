# frozen_string_literal: true

module DiscourseMechbox
  class ToolCatalog
    IMPLEMENTATION_SERVER_BUILTIN = "server_builtin"
    IMPLEMENTATION_SERVER_TEMPLATE = "server_template"
    IMPLEMENTATION_CLIENT = "client"
    IMPLEMENTATION_DESIGN_CHAIN = "design_chain"

    # Builtin calculators enabled one at a time for incremental rollout.
    ENABLED_BUILTIN_TOOL_IDS = %w[
      gear_ratio
      bolt_clamp_load
      unit_converter
      rss_calculation
      thread
      key
      bolt_group
      weld
      spring
      clutch
      belt
      chain
      tol_convert
      sigma_analysis
      fit
      distribution_chart
      thermal_expansion
      interference_fit
      bearing
      shaft
      gear
      fatigue
      beam
      sheet_metal
      cylinder
      o_ring
      structural
      manufacturing
      heat_treatment
      materials
      material_selection
      thread_table
      size_chain
      gdt_stack
      monte_carlo
      batch_analysis
    ].freeze

    # Client-side tools enabled one at a time. Add tool_id here after porting from MechBox/.
    ENABLED_CLIENT_TOOL_IDS = [].freeze

    # Design chains removed from homepage (user request). Kept empty for API compatibility.
    DESIGN_CHAIN_TOOLS = {}.freeze

    CATEGORIES = {
      "general" => { icon: "calculator", order: 0 },
      "tolerance" => { icon: "ruler-combined", order: 10 },
      "transmission" => { icon: "gear", order: 20 },
      "fastening" => { icon: "gear", order: 30 },
      "structural" => { icon: "chart-line", order: 40 },
      "materials" => { icon: "floppy-disk", order: 50 },
      "design" => { icon: "star", order: 60 },
    }.freeze

    BUILTIN_TOOLS = {
      "unit_converter" => {
        category: "general",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "value", type: "number", required: true },
          { key: "from_unit", type: "string", required: true },
          { key: "to_unit", type: "string", required: true },
        ],
        outputs: [
          { key: "converted_value", type: "number" },
          { key: "from_unit", type: "string" },
          { key: "to_unit", type: "string" },
        ],
      },
      "rss_calculation" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [{ key: "values", type: "number_array", required: true }],
        outputs: [
          { key: "rss", type: "number" },
          { key: "count", type: "integer" },
        ],
      },
      "gear_ratio" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "driver_teeth", type: "number", required: true },
          { key: "driven_teeth", type: "number", required: true },
          { key: "input_speed_rpm", type: "number", required: true },
        ],
        outputs: [
          { key: "ratio", type: "number" },
          { key: "output_speed_rpm", type: "number" },
        ],
      },
      "bolt_clamp_load" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "mode", type: "string", required: true },
          { key: "nominal_diameter_mm", type: "number", required: true },
          { key: "pitch_mm", type: "number", required: false },
          { key: "grade", type: "string", required: true },
          { key: "nut_factor", type: "number", required: false },
          { key: "mu_g", type: "number", required: false },
          { key: "mu_k", type: "number", required: false },
          { key: "d_km", type: "number", required: false },
          { key: "grip_length", type: "number", required: false },
          { key: "hole_diameter", type: "number", required: false },
          { key: "head_contact_diameter", type: "number", required: false },
          { key: "outer_diameter", type: "number", required: false },
          { key: "embedment_um", type: "number", required: false },
          { key: "delta_t", type: "number", required: false },
          { key: "external_axial_load", type: "number", required: false },
          { key: "torque_nm", type: "number", required: false },
          { key: "preload_n", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "mode", type: "string" },
          { key: "grade", type: "string" },
          { key: "preload_n", type: "number" },
          { key: "preload_kn", type: "number" },
          { key: "torque_nm", type: "number" },
          { key: "stress_area_mm2", type: "number" },
          { key: "stress_mpa", type: "number" },
          { key: "allow_stress_mpa", type: "number" },
          { key: "max_preload_n", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "gdt_position" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "deviation_x_mm", type: "number", required: true },
          { key: "deviation_y_mm", type: "number", required: true },
          { key: "tolerance_diameter_mm", type: "number", required: false },
        ],
        outputs: [
          { key: "position_diameter_mm", type: "number" },
          { key: "tolerance_diameter_mm", type: "number" },
          { key: "margin_mm", type: "number" },
          { key: "utilization", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "thread" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "diameter_mm", type: "number", required: true },
          { key: "pitch_mm", type: "number", required: false },
          { key: "grade", type: "string", required: true },
          { key: "axial_force_n", type: "number", required: true },
          { key: "engaged_length_mm", type: "number", required: false },
          { key: "friction_coeff", type: "number", required: false },
          { key: "nut_material", type: "string", required: false },
          { key: "mu_g", type: "number", required: false },
          { key: "mu_k", type: "number", required: false },
          { key: "d_km", type: "number", required: false },
          { key: "torque_nm", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "stress_area_mm2", type: "number" },
          { key: "tensile_stress_mpa", type: "number" },
          { key: "shear_stress_mpa", type: "number" },
          { key: "tightening_torque_nm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "key" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "torque_nm", type: "number", required: true },
          { key: "shaft_diameter_mm", type: "number", required: true },
          { key: "key_width_mm", type: "number", required: false },
          { key: "key_height_mm", type: "number", required: false },
          { key: "key_length_mm", type: "number", required: false },
          { key: "hub_length_mm", type: "number", required: false },
          { key: "allow_shear_mpa", type: "number", required: false },
          { key: "allow_crush_mpa", type: "number", required: false },
          { key: "key_count", type: "number", required: false },
          { key: "torque_amplitude_nm", type: "number", required: false },
          { key: "required_safety_factor", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "tangential_force_n", type: "number" },
          { key: "shear_stress_mpa", type: "number" },
          { key: "crush_stress_mpa", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "bolt_group" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "bolt_count", type: "number", required: true },
          { key: "bolt_circle_radius_mm", type: "number", required: true },
          { key: "shear_x_n", type: "number", required: false },
          { key: "shear_y_n", type: "number", required: false },
          { key: "moment_nmm", type: "number", required: false },
          { key: "allow_per_bolt_n", type: "number", required: false },
          { key: "allow_tension_per_bolt_n", type: "number", required: false },
          { key: "friction_coeff", type: "number", required: false },
          { key: "clamp_force_per_bolt_n", type: "number", required: false },
          { key: "axial_tension_n", type: "number", required: false },
          { key: "prying_arm_mm", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "direct_per_bolt_n", type: "number" },
          { key: "torsion_per_bolt_n", type: "number" },
          { key: "max_bolt_force_n", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "weld" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "weld_type", type: "string", required: true },
          { key: "steel_grade", type: "string", required: false },
          { key: "leg_size_mm", type: "number", required: false },
          { key: "thickness_mm", type: "number", required: false },
          { key: "weld_length_mm", type: "number", required: true },
          { key: "force_n", type: "number", required: true },
          { key: "eccentricity_mm", type: "number", required: false },
          { key: "heat_input", type: "number", required: false },
          { key: "plate_thickness_mm", type: "number", required: false },
          { key: "stress_range_mpa", type: "number", required: false },
          { key: "penetration_efficiency", type: "number", required: false },
          { key: "stress_concentration", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "weld_type", type: "string" },
          { key: "shear_stress_mpa", type: "number" },
          { key: "normal_stress_mpa", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "spring" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "material", type: "string", required: false },
          { key: "wire_diameter_mm", type: "number", required: true },
          { key: "mean_diameter_mm", type: "number", required: false },
          { key: "outer_diameter_mm", type: "number", required: false },
          { key: "active_coils", type: "number", required: true },
          { key: "load_n", type: "number", required: false },
          { key: "allowable_shear_mpa", type: "number", required: false },
          { key: "free_length_mm", type: "number", required: false },
          { key: "install_height_mm", type: "number", required: false },
          { key: "working_height_mm", type: "number", required: false },
          { key: "load_min_n", type: "number", required: false },
          { key: "load_max_n", type: "number", required: false },
          { key: "target_cycles", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "spring_rate_n_per_mm", type: "number" },
          { key: "shear_stress_mpa", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "clutch" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "friction_coeff", type: "number", required: false },
          { key: "force_n", type: "number", required: false },
          { key: "radius_mm", type: "number", required: false },
          { key: "inner_diameter_mm", type: "number", required: false },
          { key: "outer_diameter_mm", type: "number", required: false },
          { key: "surfaces", type: "number", required: false },
          { key: "rpm", type: "number", required: false },
          { key: "required_torque_nm", type: "number", required: false },
          { key: "thermal_fade", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "torque_nm", type: "number" },
          { key: "power_kw", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "belt" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "driver_diameter_mm", type: "number", required: true },
          { key: "driven_diameter_mm", type: "number", required: true },
          { key: "center_distance_mm", type: "number", required: true },
          { key: "rpm", type: "number", required: false },
          { key: "power_kw", type: "number", required: false },
          { key: "wrap_angle_deg", type: "number", required: false },
          { key: "power_per_belt_kw", type: "number", required: false },
          { key: "max_belt_speed_mps", type: "number", required: false },
          { key: "service_factor", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "ratio", type: "number" },
          { key: "belt_length_mm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "chain" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "pitch_mm", type: "number", required: true },
          { key: "driver_teeth", type: "number", required: true },
          { key: "driven_teeth", type: "number", required: true },
          { key: "center_distance_mm", type: "number", required: true },
          { key: "rpm", type: "number", required: false },
          { key: "power_kw", type: "number", required: false },
          { key: "allow_tension_n", type: "number", required: false },
          { key: "max_chain_speed_mps", type: "number", required: false },
          { key: "service_factor", type: "number", required: false },
          { key: "strands", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "ratio", type: "number" },
          { key: "chain_length_mm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "tol_convert" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "direction", type: "string", required: true },
          { key: "value", type: "number", required: true },
          { key: "distribution", type: "string", required: false },
          { key: "k_factor", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "result", type: "number" },
          { key: "k_factor", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "sigma_analysis" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "lsl", type: "number", required: true },
          { key: "usl", type: "number", required: true },
          { key: "mean", type: "number", required: true },
          { key: "sigma", type: "number", required: true },
          { key: "min_cpk", type: "number", required: false },
          { key: "sample_values", type: "string", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "c", type: "number" },
          { key: "cpk", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "fit" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "nominal_mm", type: "number", required: true },
          { key: "hole_code", type: "string", required: true },
          { key: "shaft_code", type: "string", required: true },
          { key: "delta_t", type: "number", required: false },
          { key: "alpha_hole", type: "number", required: false },
          { key: "alpha_shaft", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "fit_type", type: "string" },
          { key: "max_clearance", type: "number" },
          { key: "min_clearance", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "distribution_chart" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "tolerance", type: "number", required: true },
          { key: "distribution", type: "string", required: false },
          { key: "mean", type: "number", required: false },
          { key: "sigma", type: "number", required: false },
          { key: "k_factor", type: "number", required: false },
          { key: "lsl", type: "number", required: false },
          { key: "usl", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "sigma", type: "number" },
          { key: "peak_density", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "thermal_expansion" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "material", type: "string", required: false },
          { key: "length_mm", type: "number", required: true },
          { key: "delta_t", type: "number", required: true },
          { key: "alpha_micro", type: "number", required: false },
          { key: "material2", type: "string", required: false },
          { key: "alpha2_micro", type: "number", required: false },
          { key: "shaft_diameter_mm", type: "number", required: false },
          { key: "hole_diameter_mm", type: "number", required: false },
          { key: "assembly_delta_t", type: "number", required: false },
          { key: "service_delta_t", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "linear_expansion", type: "number" },
          { key: "operating_temp", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "interference_fit" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "shaft_diameter_mm", type: "number", required: true },
          { key: "hole_diameter_mm", type: "number", required: true },
          { key: "hub_outer_diameter_mm", type: "number", required: true },
          { key: "fit_length_mm", type: "number", required: false },
          { key: "friction", type: "number", required: false },
          { key: "shaft_inner_diameter_mm", type: "number", required: false },
          { key: "delta_t", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "pressure", type: "number" },
          { key: "press_force", type: "number" },
          { key: "torque_capacity_nm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "bearing" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "dynamic_load_n", type: "number", required: true },
          { key: "radial_load_n", type: "number", required: true },
          { key: "axial_load_n", type: "number", required: false },
          { key: "rpm", type: "number", required: true },
          { key: "target_hours", type: "number", required: false },
          { key: "series_id", type: "string", required: false },
          { key: "static_load_n", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "equivalent_load", type: "number" },
          { key: "l10_million_rev", type: "number" },
          { key: "life_hours", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "shaft" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "analysis_mode", type: "string", required: true },
          { key: "material_id", type: "string", required: false },
          { key: "diameter_mm", type: "number", required: true },
          { key: "inner_diameter_mm", type: "number", required: false },
          { key: "torque_nm", type: "number", required: true },
          { key: "length_mm", type: "number", required: false },
          { key: "bending_moment_nm", type: "number", required: false },
          { key: "allowable_shear_mpa", type: "number", required: false },
          { key: "allowable_stress_mpa", type: "number", required: false },
          { key: "yield_strength_mpa", type: "number", required: false },
          { key: "shear_modulus_mpa", type: "number", required: false },
          { key: "max_twist_angle_deg", type: "number", required: false },
          { key: "strength_theory", type: "string", required: false },
          { key: "stress_concentration_torsion", type: "number", required: false },
          { key: "stress_concentration_bending", type: "number", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "analysis_mode", type: "string" },
          { key: "shear_stress_mpa", type: "number" },
          { key: "bending_stress_mpa", type: "number" },
          { key: "equivalent_stress_mpa", type: "number" },
          { key: "twist_angle_deg", type: "number" },
          { key: "min_diameter_mm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "gear" => {
        category: "transmission",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "module_mm", type: "number", required: true },
          { key: "pinion_teeth", type: "integer", required: true },
          { key: "gear_teeth", type: "integer", required: false },
          { key: "face_width_mm", type: "number", required: true },
          { key: "torque_nm", type: "number", required: true },
          { key: "rpm", type: "number", required: false },
          { key: "pressure_angle_deg", type: "number", required: false },
          { key: "helix_angle_deg", type: "number", required: false },
          { key: "pinion_material", type: "string", required: false },
          { key: "gear_material", type: "string", required: false },
          { key: "application_factor", type: "number", required: false },
          { key: "iso1328_grade", type: "integer", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "standard", type: "string" },
          { key: "tangential_force_n", type: "number" },
          { key: "bending_stress_mpa", type: "number" },
          { key: "contact_stress_mpa", type: "number" },
          { key: "safety_bending", type: "number" },
          { key: "safety_contact", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "fatigue" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "material", type: "string", required: true },
          { key: "stress_amplitude_mpa", type: "number", required: true },
          { key: "target_life", type: "number", required: false },
          { key: "mean_stress_mpa", type: "number", required: false },
          { key: "mean_stress_method", type: "string", required: false },
          { key: "surface_factor", type: "number", required: false },
          { key: "size_factor", type: "number", required: false },
          { key: "loads_json", type: "string", required: false },
        ],
        outputs: [
          { key: "calc_mode", type: "string" },
          { key: "life_cycles", type: "number" },
          { key: "effective_amplitude_mpa", type: "number" },
          { key: "single_level_pass", type: "boolean" },
          { key: "miner", type: "object" },
          { key: "pass", type: "boolean" },
        ],
      },
      "beam" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "material_id", type: "string", required: false },
          { key: "case_id", type: "string", required: true },
          { key: "section_type", type: "string", required: true },
          { key: "diameter_mm", type: "number", required: false },
          { key: "inner_diameter_mm", type: "number", required: false },
          { key: "width_mm", type: "number", required: false },
          { key: "height_mm", type: "number", required: false },
          { key: "span_length_mm", type: "number", required: true },
          { key: "load_n", type: "number", required: false },
          { key: "line_load_n_per_mm", type: "number", required: false },
          { key: "elastic_modulus_mpa", type: "number", required: false },
          { key: "allowable_stress_mpa", type: "number", required: false },
          { key: "allowable_deflection_mm", type: "number", required: false },
          { key: "dynamic_factor", type: "number", required: false },
          { key: "stress_concentration", type: "number", required: false },
        ],
        outputs: [
          { key: "moment_nmm", type: "number" },
          { key: "stress_mpa", type: "number" },
          { key: "deflection_mm", type: "number" },
          { key: "inertia_mm4", type: "number" },
          { key: "section_modulus_mm3", type: "number" },
          { key: "line_load_n_per_mm", type: "number" },
          { key: "design_line_load_n_per_mm", type: "number" },
          { key: "slenderness_warning", type: "boolean" },
          { key: "pass", type: "boolean" },
        ],
      },
      "structural" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "analysis_type", type: "string", required: true },
          { key: "calc_mode", type: "string", required: true },
          { key: "diameter_mm", type: "number", required: false },
          { key: "length_m", type: "number", required: false },
          { key: "flow_rate_lpm", type: "number", required: false },
          { key: "density_kg_m3", type: "number", required: false },
          { key: "dynamic_viscosity_pa_s", type: "number", required: false },
          { key: "roughness_mm", type: "number", required: false },
          { key: "local_loss_k", type: "number", required: false },
          { key: "max_velocity_mps", type: "number", required: false },
          { key: "max_pressure_drop_kpa", type: "number", required: false },
          { key: "edge_condition", type: "string", required: false },
          { key: "thickness_mm", type: "number", required: false },
          { key: "width_mm", type: "number", required: false },
          { key: "length_mm", type: "number", required: false },
          { key: "applied_stress_mpa", type: "number", required: false },
          { key: "applied_stress_transverse_mpa", type: "number", required: false },
          { key: "imperfection_factor", type: "number", required: false },
          { key: "applied_shear_mpa", type: "number", required: false },
          { key: "case_id", type: "string", required: false },
          { key: "stiffness_n_m", type: "number", required: false },
          { key: "mass_kg", type: "number", required: false },
          { key: "span_length_mm", type: "number", required: false },
          { key: "elastic_modulus_mpa", type: "number", required: false },
          { key: "excitation_freq_hz", type: "number", required: false },
          { key: "rpm", type: "number", required: false },
          { key: "damping_ratio", type: "number", required: false },
        ],
        outputs: [
          { key: "analysis_type", type: "string" },
          { key: "velocity_mps", type: "number" },
          { key: "reynolds", type: "number" },
          { key: "total_pressure_drop_kpa", type: "number" },
          { key: "critical_stress_mpa", type: "number" },
          { key: "safety_factor", type: "number" },
          { key: "modal", type: "object" },
          { key: "resonance", type: "object" },
          { key: "pass", type: "boolean" },
        ],
      },
      "sheet_metal" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "method", type: "string", required: false },
          { key: "thickness_mm", type: "number", required: true },
          { key: "bend_radius_mm", type: "number", required: false },
          { key: "k_factor", type: "number", required: false },
          { key: "outer_sum_mm", type: "number", required: false },
          { key: "springback_deg", type: "number", required: false },
          { key: "segments_json", type: "string", required: true },
        ],
        outputs: [
          { key: "method", type: "string" },
          { key: "flat_length_mm", type: "number" },
          { key: "bend_count", type: "integer" },
          { key: "flange_pass", type: "boolean" },
          { key: "radius_pass", type: "boolean" },
          { key: "pass", type: "boolean" },
        ],
      },
      "cylinder" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "cylinder_type", type: "string", required: false },
          { key: "bore_diameter_mm", type: "number", required: true },
          { key: "rod_diameter_mm", type: "number", required: false },
          { key: "pressure_mpa", type: "number", required: true },
          { key: "flow_rate_lpm", type: "number", required: false },
          { key: "velocity_mm_s", type: "number", required: false },
          { key: "external_load_n", type: "number", required: false },
          { key: "stroke_length_mm", type: "number", required: false },
          { key: "yield_strength_mpa", type: "number", required: false },
          { key: "end_fixity", type: "string", required: false },
          { key: "efficiency", type: "number", required: false },
          { key: "load_mass_kg", type: "number", required: false },
          { key: "acceleration_m_s2", type: "number", required: false },
        ],
        outputs: [
          { key: "type", type: "string" },
          { key: "extend_force_n", type: "number" },
          { key: "retract_force_n", type: "number" },
          { key: "extend_velocity_mm_s", type: "number" },
          { key: "buckling_load_n", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "o_ring" => {
        category: "structural",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "cross_section_mm", type: "number", required: true },
          { key: "groove_diameter_mm", type: "number", required: true },
          { key: "groove_width_mm", type: "number", required: true },
          { key: "compression_percent", type: "number", required: true },
          { key: "stretch_percent", type: "number", required: false },
          { key: "pressure_mpa", type: "number", required: false },
          { key: "extrusion_gap_mm", type: "number", required: false },
          { key: "material", type: "string", required: false },
          { key: "operating_temp_c", type: "number", required: false },
          { key: "stroke_speed_m_s", type: "number", required: false },
          { key: "thermal_expansion", type: "number", required: false },
        ],
        outputs: [
          { key: "groove_depth_mm", type: "number" },
          { key: "compression_mm", type: "number" },
          { key: "fill_percent", type: "number" },
          { key: "width_ok", type: "boolean" },
          { key: "extrusion_pass", type: "boolean" },
          { key: "max_allow_pressure_mpa", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "manufacturing" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "analysis_type", type: "string", required: true },
          { key: "nominal_diameter_mm", type: "number", required: false },
          { key: "length_mm", type: "number", required: false },
          { key: "tolerance_grade", type: "string", required: false },
          { key: "operations_json", type: "string", required: false },
          { key: "removal_rate_mm3_min", type: "number", required: false },
          { key: "cast_material", type: "string", required: false },
          { key: "surface_type", type: "string", required: false },
          { key: "depth_mm", type: "number", required: false },
          { key: "rough_surface", type: "boolean", required: false },
          { key: "imperfection_factor", type: "number", required: false },
          { key: "actual_draft_angle_deg", type: "number", required: false },
        ],
        outputs: [
          { key: "analysis_type", type: "string" },
          { key: "recommended_stock_diameter_mm", type: "number" },
          { key: "total_radial_allowance_mm", type: "number" },
          { key: "draft_angle_deg", type: "number" },
          { key: "total_width_increase_mm", type: "number" },
          { key: "pass", type: "boolean" },
        ],
      },
      "heat_treatment" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "steel_preset", type: "string", required: false },
          { key: "C", type: "number", required: false },
          { key: "Mn", type: "number", required: false },
          { key: "Cr", type: "number", required: false },
          { key: "Mo", type: "number", required: false },
          { key: "V", type: "number", required: false },
          { key: "Ni", type: "number", required: false },
          { key: "Cu", type: "number", required: false },
          { key: "grain_size", type: "number", required: false },
          { key: "part_diameter_mm", type: "number", required: false },
          { key: "temper_temp_c", type: "number", required: false },
          { key: "temper_time_h", type: "number", required: false },
          { key: "min_final_hrc", type: "number", required: false },
          { key: "max_final_hrc", type: "number", required: false },
        ],
        outputs: [
          { key: "carbon_equivalent", type: "number" },
          { key: "weldability_key", type: "string" },
          { key: "hardenability", type: "object" },
          { key: "temper", type: "object" },
          { key: "pass", type: "boolean" },
        ],
      },
      "materials" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: false },
          { key: "query", type: "string", required: false },
          { key: "category", type: "string", required: false },
          { key: "temp_c", type: "number", required: false },
          { key: "material_id", type: "string", required: false },
        ],
        outputs: [
          { key: "materials", type: "array" },
          { key: "categories", type: "array" },
          { key: "count", type: "number" },
          { key: "total_count", type: "number" },
        ],
      },
      "material_selection" => {
        category: "materials",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "calc_mode", type: "string", required: true },
          { key: "min_sigma_allow_mpa", type: "number", required: false },
          { key: "max_density", type: "number", required: false },
          { key: "temp_c", type: "number", required: false },
          { key: "min_weldability", type: "number", required: false },
          { key: "max_cost_index", type: "number", required: false },
          { key: "weight_strength", type: "number", required: false },
          { key: "weight_light", type: "number", required: false },
          { key: "weight_cost", type: "number", required: false },
          { key: "weight_weldability", type: "number", required: false },
          { key: "weight_machinability", type: "number", required: false },
        ],
        outputs: [
          { key: "top_pick", type: "object" },
          { key: "recommendations", type: "array" },
          { key: "filtered_count", type: "number" },
          { key: "total_count", type: "number" },
        ],
      },
      "thread_table" => {
        category: "fastening",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "system", type: "string", required: false },
          { key: "query", type: "string", required: false },
          { key: "sub_series", type: "string", required: false },
          { key: "priority", type: "integer", required: false },
          { key: "diameter_min", type: "number", required: false },
          { key: "diameter_max", type: "number", required: false },
          { key: "row_id", type: "string", required: false },
          { key: "page", type: "integer", required: false },
        ],
        outputs: [
          { key: "rows", type: "array" },
          { key: "systems", type: "array" },
          { key: "count", type: "number" },
          { key: "matched_count", type: "number" },
          { key: "total_count", type: "number" },
          { key: "page", type: "integer" },
          { key: "page_count", type: "integer" },
        ],
      },
      "size_chain" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "closed_ring", type: "object", required: true },
          { key: "component_rings", type: "array", required: true },
        ],
        outputs: [
          { key: "closed_ring", type: "object" },
          { key: "worst", type: "object" },
          { key: "rss", type: "object" },
          { key: "ring_contributions", type: "array" },
          { key: "warnings", type: "array" },
          { key: "pass", type: "boolean" },
        ],
      },
      "gdt_stack" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "type_id", type: "string", required: true },
          { key: "method", type: "string", required: false },
          { key: "closed_ring", type: "object", required: true },
          { key: "rings", type: "array", required: true },
          { key: "datums", type: "array", required: false },
          { key: "tolerance_modifier", type: "string", required: false },
          { key: "bonus_tolerance", type: "number", required: false },
          { key: "auto_bonus", type: "boolean", required: false },
        ],
        outputs: [
          { key: "type_id", type: "string" },
          { key: "chain", type: "object" },
          { key: "pass", type: "boolean" },
          { key: "modifier", type: "object" },
          { key: "contributions", type: "array" },
          { key: "datum_stack", type: "object" },
          { key: "effective_with_datum", type: "number" },
          { key: "worst_case", type: "object" },
          { key: "warnings", type: "array" },
        ],
      },
      "monte_carlo" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "closed_ring", type: "object", required: true },
          { key: "component_rings", type: "array", required: true },
          { key: "iterations", type: "integer", required: false },
          { key: "distribution", type: "string", required: false },
          { key: "custom_k", type: "number", required: false },
          { key: "truncated_normal", type: "boolean", required: false },
          { key: "seed", type: "integer", required: false },
          { key: "include_sensitivity", type: "boolean", required: false },
        ],
        outputs: [
          { key: "mean", type: "number" },
          { key: "std", type: "number" },
          { key: "pass_rate", type: "number" },
          { key: "histogram", type: "array" },
          { key: "worst", type: "object" },
          { key: "rss", type: "object" },
          { key: "sensitivity", type: "object" },
          { key: "warnings", type: "array" },
        ],
      },
      "batch_analysis" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "target_min", type: "number", required: true },
          { key: "target_max", type: "number", required: true },
          { key: "csv", type: "string", required: false },
          { key: "rows", type: "array", required: false },
          { key: "pass_mode", type: "string", required: false },
        ],
        outputs: [
          { key: "summary", type: "object" },
          { key: "results", type: "array" },
          { key: "pass_mode", type: "string" },
        ],
      },
    }.freeze

    # Client-side tools (MechBox Vue). Listed for discovery; calculation runs in browser.
    CLIENT_TOOLS = {
      "statistics" => { category: "tolerance", route: "/statistics" },
      "tolerance_allocation" => { category: "tolerance", route: "/allocation" },
      "bolt_preload" => { category: "fastening", route: "/bolt-preload" },
      "units" => { category: "general", route: "/units" },
      "design_powertrain" => { category: "design", route: "/design/powertrain" },
      "design_bolt_joint" => { category: "design", route: "/design/bolt-joint" },
      "design_projects" => { category: "design", route: "/design/projects" },
    }.freeze

    class << self
      def builtin_tool_ids
        BUILTIN_TOOLS.keys
      end

      def client_tool_ids
        CLIENT_TOOLS.keys
      end

      def builtin_tool_available?(tool_id)
        ENABLED_BUILTIN_TOOL_IDS.include?(tool_id.to_s)
      end

      def client_tool_available?(tool_id)
        ENABLED_CLIENT_TOOL_IDS.include?(tool_id.to_s)
      end

      def design_chains_json
        DESIGN_CHAIN_TOOLS.map do |tool_id, definition|
          {
            tool_id:,
            name: I18n.t("mechbox.catalog.tools.#{tool_id}.name", default: tool_id.humanize),
            description:
              I18n.t("mechbox.catalog.tools.#{tool_id}.description", default: ""),
            category: definition[:category],
            implementation: IMPLEMENTATION_DESIGN_CHAIN,
            status: definition[:status],
            available: false,
          }
        end
      end

      def known_tool_id?(tool_id)
        tool_id.present? &&
          (BUILTIN_TOOLS.key?(tool_id) || CLIENT_TOOLS.key?(tool_id) || template_tool?(tool_id))
      end

      def template_tool?(tool_id)
        tool_id.to_s.start_with?("template_")
      end

      def find_builtin(tool_id)
        BUILTIN_TOOLS[tool_id.to_s]
      end

      def find_client(tool_id)
        CLIENT_TOOLS[tool_id.to_s]
      end

      def implementation_for(tool_id)
        return IMPLEMENTATION_SERVER_BUILTIN if BUILTIN_TOOLS.key?(tool_id.to_s)
        return IMPLEMENTATION_CLIENT if CLIENT_TOOLS.key?(tool_id.to_s)
        IMPLEMENTATION_SERVER_TEMPLATE if template_tool?(tool_id)
      end

      def categories_json
        CATEGORIES.map do |id, meta|
          { id:, icon: meta[:icon], order: meta[:order], name: I18n.t("mechbox.categories.#{id}") }
        end
      end

      def builtin_tools_json
        BUILTIN_TOOLS.map do |tool_id, definition|
          tool_json(tool_id, definition, IMPLEMENTATION_SERVER_BUILTIN)
        end
      end

      def client_tools_json
        CLIENT_TOOLS.map do |tool_id, definition|
          tool_json(
            tool_id,
            {
              category: definition[:category],
              inputs: [],
              outputs: [],
              client_route: definition[:route],
            },
            IMPLEMENTATION_CLIENT,
          )
        end
      end

      def available_client_tools_json
        client_tools_json.select { |tool| tool[:available] }
      end

      def tool_summary(tool_id)
        if (builtin = find_builtin(tool_id))
          return tool_json(tool_id, builtin, IMPLEMENTATION_SERVER_BUILTIN)
        end

        if (client = find_client(tool_id))
          return(
            tool_json(
              tool_id,
              {
                category: client[:category],
                inputs: [],
                outputs: [],
                client_route: client[:route],
              },
              IMPLEMENTATION_CLIENT,
            )
          )
        end

        nil
      end

      private

      def tool_json(tool_id, definition, implementation)
        available =
          case implementation
          when IMPLEMENTATION_SERVER_BUILTIN
            builtin_tool_available?(tool_id)
          when IMPLEMENTATION_CLIENT
            client_tool_available?(tool_id)
          else
            false
          end

        {
          tool_id:,
          name: I18n.t("mechbox.tools.#{tool_id}.name", default: tool_id.humanize),
          description:
            I18n.t("mechbox.tools.#{tool_id}.description", default: ""),
          category: definition[:category],
          implementation:,
          inputs: definition[:inputs] || [],
          outputs: definition[:outputs] || [],
          client_route: definition[:client_route],
          available:,
        }
      end
    end
  end
end
