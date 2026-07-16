# frozen_string_literal: true

module DiscourseMechbox
  # Homepage directory aligned with MechBox HomeView (design-chain excluded).
  module HomeCatalog
    DEFAULT_ICON = "calculator"

    ANALYSIS_GROUPS = [
      {
        id: "linear_1d",
        icon: "ruler-combined",
        tools: [
          { id: "gear_gap", icon: "gear" },
          { id: "bearing_fit", icon: "circle-question" },
          { id: "shaft_tolerance", icon: "minus" },
          { id: "shim_thickness", icon: "copy" },
        ],
      },
      {
        id: "planar_2d",
        icon: "table-cells",
        tools: [
          { id: "parallelism", icon: "arrows-up-down" },
          { id: "perpendicularity", icon: "arrows-left-right" },
          { id: "profile_2d", icon: "crop" },
          { id: "flatness", icon: "table-cells" },
          { id: "straightness", icon: "minus" },
        ],
      },
      {
        id: "spatial_3d",
        icon: "cube",
        tools: [
          { id: "assembly_3d", icon: "cube" },
          { id: "housing_assembly", icon: "briefcase" },
          { id: "frame_assembly", icon: "building" },
          { id: "stack_up_3d", icon: "layer-group" },
        ],
      },
      {
        id: "gdt_tolerance",
        icon: "crosshairs",
        tools: [
          { id: "position", icon: "crosshairs" },
          { id: "coaxiality", icon: "share-nodes" },
          { id: "profile_gdt", icon: "crop" },
          { id: "runout", icon: "rotate" },
          { id: "roundness", icon: "circle" },
        ],
      },
    ].freeze

    STAT_TOOLS = [
      { id: "tol_convert", tool_id: "tol_convert", icon: "arrows-left-right" },
      { id: "rss_calculation", tool_id: "rss_calculation", icon: "chart-column" },
      { id: "sigma_analysis", tool_id: "sigma_analysis", icon: "chart-line" },
      { id: "distribution_chart", icon: "chart-pie" },
      { id: "monte_carlo", tool_id: "monte_carlo", icon: "chart-simple" },
      { id: "quality", icon: "clipboard-list" },
      { id: "analytics", icon: "chart-area" },
    ].freeze

    MECH_GROUPS = [
      {
        id: "chain",
        tools: [
          { id: "size_chain", tool_id: "size_chain", icon: "pen" },
          { id: "batch_analysis", tool_id: "batch_analysis", icon: "list" },
          { id: "tolerance_allocation", tool_id: "tolerance_allocation", icon: "scale-balanced" },
          { id: "fit", tool_id: "fit", icon: "scale-balanced" },
          { id: "gdt_stack", tool_id: "gdt_stack", icon: "crosshairs" },
          { id: "unit_converter", tool_id: "unit_converter", icon: "arrows-left-right" },
          { id: "interference_fit", tool_id: "interference_fit", icon: "coins" },
          { id: "thermal_expansion", tool_id: "thermal_expansion", icon: "sun" },
          { id: "fatigue", tool_id: "fatigue", icon: "chart-line" },
          { id: "gear", tool_id: "gear", icon: "sliders" },
          { id: "gear_ratio", tool_id: "gear_ratio", icon: "gear" },
          { id: "thread", tool_id: "thread", icon: "link" },
          { id: "thread_table", icon: "list" },
          { id: "bolt_clamp_load", tool_id: "bolt_clamp_load", icon: "bolt" },
          { id: "bearing", tool_id: "bearing", icon: "circle-question" },
        ],
      },
      {
        id: "drive",
        tools: [
          { id: "beam", tool_id: "beam", icon: "minus" },
          { id: "sheet_metal", tool_id: "sheet_metal", icon: "crop" },
          { id: "o_ring", icon: "circle-check" },
          { id: "shaft", tool_id: "shaft", icon: "arrows-up-down" },
          { id: "key", tool_id: "key", icon: "key" },
          { id: "weld", tool_id: "weld", icon: "medal" },
          { id: "bolt_group", tool_id: "bolt_group", icon: "table-cells" },
          { id: "spring", tool_id: "spring", icon: "rotate" },
          { id: "clutch", tool_id: "clutch", icon: "share-nodes" },
          { id: "belt", tool_id: "belt", icon: "minus" },
          { id: "chain", tool_id: "chain", icon: "link" },
          { id: "structural", tool_id: "structural", icon: "gauge" },
        ],
      },
      {
        id: "material",
        tools: [
          { id: "material_selection", tool_id: "material_selection", icon: "book" },
          { id: "heat_treatment", icon: "sun" },
          { id: "manufacturing", icon: "screwdriver-wrench" },
          { id: "cylinder", tool_id: "cylinder", icon: "gauge" },
          { id: "materials", tool_id: "materials", icon: "book-open" },
        ],
      },
    ].freeze

    # Icons used on the homepage — keep in sync with plugin.rb register_svg_icon list.
    HOME_ICONS = (
      ANALYSIS_GROUPS.flat_map { |g| [g[:icon]] + g[:tools].map { |t| t[:icon] } } +
      STAT_TOOLS.map { |t| t[:icon] } +
      MECH_GROUPS.flat_map { |g| g[:tools].map { |t| t[:icon] } } +
      [DEFAULT_ICON]
    ).compact.uniq.freeze

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
          icon: group[:icon] || DEFAULT_ICON,
          tools:
            group[:tools].map do |tool|
              id = tool[:id]
              {
                id:,
                name: I18n.t("mechbox.home.analysis_tools.#{id}"),
                icon: tool[:icon] || DEFAULT_ICON,
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
        icon: entry[:icon] || DEFAULT_ICON,
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
      entry =
        MECH_GROUPS.flat_map { |g| g[:tools] }.find { |t| t[:tool_id] == tool_id } ||
          STAT_TOOLS.find { |t| t[:tool_id] == tool_id }

      summary = ToolCatalog.tool_summary(tool_id)
      {
        id: tool_id,
        tool_id:,
        icon: entry&.dig(:icon) || DEFAULT_ICON,
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
