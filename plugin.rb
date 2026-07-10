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
end

require_relative "lib/discourse_mechbox/engine"

after_initialize do
  %w[
    lib/discourse_mechbox/api_capabilities.rb
    lib/discourse_mechbox/tool_catalog.rb
    lib/discourse_mechbox/user_preferences.rb
    lib/discourse_mechbox/concerns/feature_gate.rb
    lib/discourse_mechbox/calculator_registry.rb
    lib/discourse_mechbox/formula_evaluator.rb
    lib/discourse_mechbox/guardian_extension.rb
    app/models/discourse_mechbox/calculation_record.rb
    app/models/discourse_mechbox/favorite_tool.rb
    app/models/discourse_mechbox/formula_template.rb
    app/models/discourse_mechbox/template_version.rb
    app/serializers/discourse_mechbox/calculation_record_serializer.rb
    app/serializers/discourse_mechbox/favorite_tool_serializer.rb
    app/serializers/discourse_mechbox/formula_template_serializer.rb
    app/serializers/discourse_mechbox/template_version_serializer.rb
    app/services/discourse_mechbox/calculation_runner.rb
    app/services/discourse_mechbox/record_creator.rb
    app/services/discourse_mechbox/metadata_builder.rb
    app/services/discourse_mechbox/template_manager.rb
    app/controllers/discourse_mechbox/base_controller.rb
    app/controllers/discourse_mechbox/metadata_controller.rb
    app/controllers/discourse_mechbox/tools_controller.rb
    app/controllers/discourse_mechbox/calculations_controller.rb
    app/controllers/discourse_mechbox/records_controller.rb
    app/controllers/discourse_mechbox/favorites_controller.rb
    app/controllers/discourse_mechbox/templates_controller.rb
    app/controllers/discourse_mechbox/template_versions_controller.rb
    app/controllers/discourse_mechbox/preferences_controller.rb
    app/controllers/discourse_mechbox/client_tools_controller.rb
    app/controllers/discourse_mechbox/exports_controller.rb
    app/controllers/discourse_mechbox/topic_drafts_controller.rb
    app/controllers/discourse_mechbox/projects_controller.rb
    app/controllers/discourse_mechbox/admin/stats_controller.rb
  ].each { |path| require_relative path }

  reloadable_patch { Guardian.prepend(::DiscourseMechbox::GuardianExtension) }

  Discourse::Application.routes.append { mount ::DiscourseMechbox::Engine, at: "/mechbox/api" }
end
