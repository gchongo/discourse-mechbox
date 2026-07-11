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

module ::DiscourseMechbox
  PLUGIN_NAME = "discourse-mechbox"
end

require_relative "lib/discourse_mechbox/engine"

after_initialize do
  require_relative "app/controllers/discourse_mechbox/base_controller"
  require_relative "app/controllers/discourse_mechbox/skeleton_controller"

  Discourse::Application.routes.append { mount ::DiscourseMechbox::Engine, at: "/mechbox/api" }
end
