# frozen_string_literal: true

module DiscourseMechbox
  # Central registry of API features. Metadata endpoint exposes this to clients.
  # Set enabled: false until the controller implementation is production-ready.
  module ApiCapabilities
    API_VERSION = 1

    FEATURES = {
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
      },
      records_search: {
        enabled: true,
      },
      records_bulk_destroy: {
        enabled: true,
      },
      favorites: {
        enabled: true,
      },
      templates: {
        enabled: true,
      },
      template_versions: {
        enabled: true,
      },
      preferences: {
        enabled: true,
      },
      client_tools: {
        enabled: false,
        description: "Browser-side MechBox tools with optional server verification",
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
        description: "Multi-step design projects and tool chains",
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
