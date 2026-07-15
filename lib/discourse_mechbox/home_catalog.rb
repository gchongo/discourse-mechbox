# frozen_string_literal: true

module DiscourseMechbox
  # Homepage directory aligned with MechBox HomeView (design-chain excluded).
  module HomeCatalog
    ANALYSIS_GROUPS = [
      {
        id: "linear_1d",
        tools: %w[gear_gap bearing_fit shaft_tolerance shim_thickness],
      },
      {
        id: "planar_2d",
        tools: %w[parallelism perpendicularity profile_2d flatness straightness],
      },
      {
        id: "spatial_3d",
        tools: %w[assembly_3d housing_assembly frame_assembly stack_up_3d],
      },
      {
        id: "gdt_tolerance",
        tools: %w[position coaxiality profile_gdt runout roundness],
      },
    ].freeze

    STAT_TOOLS = [
      { id: "tol_convert" },
      { id: "rss_calculation", tool_id: "rss_calculation" },
      { id: "sigma_analysis" },
      { id: "distribution_chart" },
      { id: "monte_carlo", tool_id: "monte_carlo" },
      { id: "quality" },
      { id: "analytics" },
    ].freeze

    MECH_GROUPS = [
      {
        id: "chain",
        tools: [
          { id: "size_chain", tool_id: "size_chain" },
          { id: "batch_analysis", tool_id: "batch_analysis" },
          { id: "tolerance_allocation", tool_id: "tolerance_allocation" },
          { id: "fit", tool_id: "fit" },
          { id: "gdt_stack", tool_id: "gdt_stack" },
          { id: "unit_converter", tool_id: "unit_converter" },
          { id: "interference_fit", tool_id: "interference_fit" },
          { id: "thermal_expansion", tool_id: "thermal_expansion" },
          { id: "fatigue", tool_id: "fatigue" },
          { id: "gear", tool_id: "gear" },
          { id: "gear_ratio", tool_id: "gear_ratio" },
          { id: "thread", tool_id: "thread" },
          { id: "thread_table" },
          { id: "bolt_clamp_load", tool_id: "bolt_clamp_load" },
          { id: "bearing", tool_id: "bearing" },
        ],
      },
      {
        id: "drive",
        tools: [
          { id: "beam", tool_id: "beam" },
          { id: "sheet_metal", tool_id: "sheet_metal" },
          { id: "o_ring" },
          { id: "shaft", tool_id: "shaft" },
          { id: "key", tool_id: "key" },
          { id: "weld", tool_id: "weld" },
          { id: "bolt_group", tool_id: "bolt_group" },
          { id: "spring", tool_id: "spring" },
          { id: "clutch", tool_id: "clutch" },
          { id: "belt", tool_id: "belt" },
          { id: "chain", tool_id: "chain" },
          { id: "structural", tool_id: "structural" },
        ],
      },
      {
        id: "material",
        tools: [
          { id: "material_selection", tool_id: "material_selection" },
          { id: "heat_treatment" },
          { id: "manufacturing" },
          { id: "cylinder", tool_id: "cylinder" },
          { id: "materials", tool_id: "materials" },
        ],
      },
    ].freeze

    module_function

    def as_json
      available =
        ToolCatalog::ENABLED_BUILTIN_TOOL_IDS.map { |tool_id| card_for_tool_id(tool_id) }

      {
        available_tools: available,
        analysis_groups: analysis_groups_json,
        stat_tools: STAT_TOOLS.map { |tool| card_from_entry(tool) },
        mech_groups: mech_groups_json,
        counts: {
          available: available.size,
          catalog: catalog_tool_count,
        },
      }
    end

    def analysis_groups_json
      ANALYSIS_GROUPS.map do |group|
        {
          id: group[:id],
          name: I18n.t("mechbox.home.analysis_groups.#{group[:id]}"),
          tools:
            group[:tools].map do |id|
              {
                id:,
                name: I18n.t("mechbox.home.analysis_tools.#{id}"),
                available: false,
              }
            end,
        }
      end
    end

    def mech_groups_json
      MECH_GROUPS.map do |group|
        {
          id: group[:id],
          name: I18n.t("mechbox.home.mech_groups.#{group[:id]}"),
          tools: group[:tools].map { |tool| card_from_entry(tool) },
        }
      end
    end

    def card_from_entry(entry)
      id = (entry[:id] || entry[:tool_id]).to_s
      tool_id = entry[:tool_id]&.to_s
      summary = tool_id.present? ? ToolCatalog.tool_summary(tool_id) : nil
      available = summary ? !!summary[:available] : false

      {
        id:,
        tool_id:,
        name:
          I18n.t(
            "mechbox.home.tools.#{id}.name",
            default: summary&.dig(:name) || id.tr("_", " "),
          ),
        description:
          I18n.t(
            "mechbox.home.tools.#{id}.description",
            default: summary&.dig(:description) || "",
          ),
        available:,
      }
    end

    def card_for_tool_id(tool_id)
      summary = ToolCatalog.tool_summary(tool_id)
      {
        id: tool_id,
        tool_id:,
        name:
          I18n.t(
            "mechbox.home.tools.#{tool_id}.name",
            default: summary[:name],
          ),
        description:
          I18n.t(
            "mechbox.home.tools.#{tool_id}.description",
            default: summary[:description],
          ),
        available: summary[:available],
      }
    end

    def catalog_tool_count
      analysis = ANALYSIS_GROUPS.sum { |g| g[:tools].size }
      stats = STAT_TOOLS.size
      mech = MECH_GROUPS.sum { |g| g[:tools].size }
      analysis + stats + mech
    end
  end
end
