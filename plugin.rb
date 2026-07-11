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
  require_relative "lib/discourse_mechbox/api_capabilities"
  require_relative "lib/discourse_mechbox/database_features"
  require_relative "lib/discourse_mechbox/tool_catalog"
  require_relative "lib/discourse_mechbox/user_preferences"
  require_relative "lib/discourse_mechbox/guardian_extension"
  require_relative "app/services/discourse_mechbox/metadata_builder"
  require_relative "app/controllers/discourse_mechbox/base_controller"
  require_relative "app/controllers/discourse_mechbox/skeleton_controller"
  require_relative "app/controllers/discourse_mechbox/metadata_controller"
  require_relative "app/controllers/discourse_mechbox/tools_controller"
  require_relative "app/controllers/discourse_mechbox/mechbox_page_controller"

  Discourse::Application.routes.append do
    mount ::DiscourseMechbox::Engine, at: "/mechbox/api"

    get "/mechbox(/*rest)" => "discourse_mechbox/mechbox_page#index",
        constraints: ->(request) { request.format.nil? || request.format.html? }
  end

  reloadable_patch { Guardian.prepend(DiscourseMechbox::GuardianExtension) }
end
