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
    app/controllers/discourse_mechbox/base_controller.rb
    app/controllers/discourse_mechbox/calculations_controller.rb
    app/controllers/discourse_mechbox/favorites_controller.rb
    app/controllers/discourse_mechbox/metadata_controller.rb
    app/controllers/discourse_mechbox/records_controller.rb
    app/controllers/discourse_mechbox/templates_controller.rb
    app/models/discourse_mechbox/calculation_record.rb
    app/models/discourse_mechbox/favorite_tool.rb
    app/models/discourse_mechbox/formula_template.rb
    app/models/discourse_mechbox/template_version.rb
    app/serializers/discourse_mechbox/calculation_record_serializer.rb
    app/serializers/discourse_mechbox/favorite_tool_serializer.rb
    app/serializers/discourse_mechbox/formula_template_serializer.rb
    lib/discourse_mechbox/calculator_registry.rb
    lib/discourse_mechbox/formula_evaluator.rb
    lib/discourse_mechbox/guardian_extension.rb
  ].each { |path| require_relative path }

  reloadable_patch { Guardian.prepend(::DiscourseMechbox::GuardianExtension) }

  Discourse::Application.routes.append { mount ::DiscourseMechbox::Engine, at: "/mechbox/api" }
end
