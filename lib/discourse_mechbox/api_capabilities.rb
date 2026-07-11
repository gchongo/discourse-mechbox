# frozen_string_literal: true

module DiscourseMechbox
  # Central registry of API features. Metadata endpoint exposes this to clients.
  # Set enabled: false until the controller implementation is production-ready.
  module ApiCapabilities
    API_VERSION = 1

    FEATURES = {
      metadata: {
        enabled: true,
        description: "Bootstrap payload for the MechBox client",
      },
      tools: {
        enabled: true,
        description: "Tool catalog and per-tool schema metadata",
      },
      calculate: {
        enabled: true,
        description: "Run builtin or template-backed calculations",
      },
      calculate_validate: {
        enabled: true,
        description: "Validate calculation inputs without persisting",
      },
      records_index: {
        enabled: true,
        description: "List and filter saved calculation records",
      },
      records_search: {
        enabled: true,
        description: "Alias endpoint for server-side record search",
      },
      records_show: {
        enabled: true,
        description: "Fetch one saved record by id",
      },
      records_destroy: {
        enabled: true,
        description: "Delete one saved record by id",
      },
      records_bulk_destroy: {
        enabled: true,
        description: "Delete multiple saved records in a single request",
      },
      favorites: {
        enabled: true,
        description: "Create, list, and remove favorite tools",
      },
      templates: {
        enabled: true,
        description: "List and manage formula templates",
      },
      template_versions: {
        enabled: true,
      },
      preferences: {
        enabled: true,
      },
      client_tools: {
        enabled: false,
        description:
          "Browser-side MechBox tools. Enable per tool via ToolCatalog::ENABLED_CLIENT_TOOL_IDS.",
      },
      exports: {
        enabled: false,
        description: "PDF, Excel, and image export jobs",
      },
      topic_drafts: {
        enabled: false,
        description: "Create Discourse topic drafts from calculation results",
      },
      projects: {
        enabled: false,
        description:
          "Multi-step design projects and tool chains (shaft_system_chain, bolt_connection_chain)",
      },
      admin_stats: {
        enabled: true,
        description: "Aggregate usage statistics for administrators",
      },
    }.freeze

    def self.enabled?(feature)
      FEATURES.dig(feature.to_sym, :enabled) == true
    end

    def self.as_json
      FEATURES.transform_values do |config|
        { "enabled" => config[:enabled], "description" => config[:description] }
      end
    end
  end
end
