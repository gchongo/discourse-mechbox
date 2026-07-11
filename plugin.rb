# frozen_string_literal: true

# name: discourse-mechbox
# about: Mechanical engineering calculator toolbox with saved records, favorites, and enterprise formula templates.
# version: 0.1
# authors: Mechbox
# url: https://github.com/discourse/discourse/tree/main/plugins/discourse-mechbox

enabled_site_setting :mechbox_enabled

register_asset "stylesheets/common/mechbox.scss"
register_asset "stylesheets/desktop/mechbox.scss", :desktop
register_asset "stylesheets/mobile/mechbox.scss", :mobile

register_svg_icon "calculator"
register_svg_icon "star"
register_svg_icon "ruler-combined"
register_svg_icon "chart-line"
register_svg_icon "gear"
register_svg_icon "floppy-disk"

module ::DiscourseMechbox
  PLUGIN_NAME = "discourse-mechbox"

  PHASE1_LOAD_PATHS = %w[
    lib/discourse_mechbox/concerns/feature_gate
    lib/discourse_mechbox/api_capabilities
    lib/discourse_mechbox/database_features
    lib/discourse_mechbox/tool_catalog
    lib/discourse_mechbox/calculator_registry
    lib/discourse_mechbox/formula_evaluator
    lib/discourse_mechbox/user_preferences
    lib/discourse_mechbox/guardian_extension
    app/models/discourse_mechbox/calculation_record
    app/models/discourse_mechbox/formula_template
    app/models/discourse_mechbox/template_version
    app/models/discourse_mechbox/favorite_tool
    app/serializers/discourse_mechbox/formula_template_serializer
    app/services/discourse_mechbox/metadata_builder
    app/services/discourse_mechbox/record_creator
    app/services/discourse_mechbox/calculation_runner
    app/controllers/discourse_mechbox/base_controller
    app/controllers/discourse_mechbox/skeleton_controller
    app/controllers/discourse_mechbox/metadata_controller
    app/controllers/discourse_mechbox/tools_controller
    app/controllers/discourse_mechbox/calculations_controller
  ].freeze
end

require_relative "lib/discourse_mechbox/engine"

after_initialize do |plugin|
  next unless plugin.enabled?

  DiscourseMechbox::PHASE1_LOAD_PATHS.each { |path| require_relative path }

  reloadable_patch { Guardian.prepend(::DiscourseMechbox::GuardianExtension) }

  Discourse::Application.routes.append do
    mount ::DiscourseMechbox::Engine, at: "/mechbox/api"

    get "/mechbox(/*rest)" => "list#latest",
        constraints: ->(request) { request.format.nil? || request.format.html? }
  end
end
