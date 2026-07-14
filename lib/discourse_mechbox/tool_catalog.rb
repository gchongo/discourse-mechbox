# frozen_string_literal: true

module DiscourseMechbox
  class ToolCatalog
    IMPLEMENTATION_SERVER_BUILTIN = "server_builtin"
    IMPLEMENTATION_SERVER_TEMPLATE = "server_template"
    IMPLEMENTATION_CLIENT = "client"
    IMPLEMENTATION_DESIGN_CHAIN = "design_chain"

    # Builtin calculators enabled one at a time for incremental rollout.
    ENABLED_BUILTIN_TOOL_IDS = %w[gear_ratio bolt_clamp_load].freeze

    # Client-side tools enabled one at a time. Add tool_id here after porting from MechBox/.
    ENABLED_CLIENT_TOOL_IDS = [].freeze

    # Multi-tool design chains — deferred to the projects module (Phase 5).
    DESIGN_CHAIN_TOOLS = {
      "shaft_system_chain" => { category: "design", status: "deferred" },
      "bolt_connection_chain" => { category: "design", status: "deferred" },
    }.freeze

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
          {
            key: "mode",
            type: "string",
            required: true,
            description: "torque2force | force2torque",
          },
          { key: "torque_nm", type: "number", required: false },
          { key: "preload_n", type: "number", required: false },
          { key: "nut_factor", type: "number", required: true },
          { key: "nominal_diameter_mm", type: "number", required: true },
        ],
        outputs: [
          { key: "mode", type: "string" },
          { key: "preload_n", type: "number" },
          { key: "preload_kn", type: "number" },
          { key: "torque_nm", type: "number" },
        ],
      },
      "gdt_position" => {
        category: "tolerance",
        implementation: IMPLEMENTATION_SERVER_BUILTIN,
        inputs: [
          { key: "deviation_x_mm", type: "number", required: true },
          { key: "deviation_y_mm", type: "number", required: true },
        ],
        outputs: [{ key: "position_diameter_mm", type: "number" }],
      },
    }.freeze

    # Client-side tools (MechBox Vue). Listed for discovery; calculation runs in browser.
    CLIENT_TOOLS = {
      "size_chain" => { category: "tolerance", route: "/editor" },
      "statistics" => { category: "tolerance", route: "/statistics" },
      "monte_carlo" => { category: "tolerance", route: "/monte-carlo" },
      "batch_analysis" => { category: "tolerance", route: "/batch" },
      "tolerance_allocation" => { category: "tolerance", route: "/allocation" },
      "gdt_stack" => { category: "tolerance", route: "/gdt-stack" },
      "gear" => { category: "transmission", route: "/gear" },
      "bearing" => { category: "transmission", route: "/bearing" },
      "shaft" => { category: "transmission", route: "/shaft" },
      "belt" => { category: "transmission", route: "/belt" },
      "chain" => { category: "transmission", route: "/chain" },
      "clutch" => { category: "transmission", route: "/clutch" },
      "bolt_preload" => { category: "fastening", route: "/bolt-preload" },
      "bolt_group" => { category: "fastening", route: "/bolt-group" },
      "thread" => { category: "fastening", route: "/thread" },
      "weld" => { category: "fastening", route: "/weld" },
      "key" => { category: "fastening", route: "/key" },
      "spring" => { category: "structural", route: "/spring" },
      "beam" => { category: "structural", route: "/beam" },
      "fatigue" => { category: "structural", route: "/fatigue" },
      "structural" => { category: "structural", route: "/structural" },
      "sheet_metal" => { category: "structural", route: "/sheet-metal" },
      "cylinder" => { category: "structural", route: "/cylinder" },
      "thermal_expansion" => { category: "materials", route: "/thermal-expansion" },
      "interference_fit" => { category: "materials", route: "/interference-fit" },
      "fit" => { category: "materials", route: "/fit" },
      "materials" => { category: "materials", route: "/materials" },
      "material_selection" => { category: "materials", route: "/material-selection" },
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
