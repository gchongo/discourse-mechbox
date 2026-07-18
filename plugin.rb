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
# Homepage tool icons (HomeCatalog::HOME_ICONS)
register_svg_icon "arrows-left-right"
register_svg_icon "arrows-up-down"
register_svg_icon "bolt"
register_svg_icon "book"
register_svg_icon "book-open"
register_svg_icon "briefcase"
register_svg_icon "building"
register_svg_icon "chart-area"
register_svg_icon "chart-column"
register_svg_icon "chart-pie"
register_svg_icon "chart-simple"
register_svg_icon "circle"
register_svg_icon "circle-check"
register_svg_icon "circle-question"
register_svg_icon "clipboard-list"
register_svg_icon "coins"
register_svg_icon "copy"
register_svg_icon "crop"
register_svg_icon "crosshairs"
register_svg_icon "cube"
register_svg_icon "gauge"
register_svg_icon "key"
register_svg_icon "layer-group"
register_svg_icon "link"
register_svg_icon "list"
register_svg_icon "medal"
register_svg_icon "minus"
register_svg_icon "pen"
register_svg_icon "rotate"
register_svg_icon "scale-balanced"
register_svg_icon "screwdriver-wrench"
register_svg_icon "share-nodes"
register_svg_icon "sliders"
register_svg_icon "sun"
register_svg_icon "table-cells"

module ::DiscourseMechbox
  PLUGIN_NAME = "discourse-mechbox"
end

require_relative "lib/discourse_mechbox/engine"

after_initialize do
  require_relative "lib/discourse_mechbox/api_capabilities"
  require_relative "lib/discourse_mechbox/database_features"
  require_relative "lib/discourse_mechbox/tool_catalog"
  require_relative "lib/discourse_mechbox/home_catalog"
  require_relative "lib/discourse_mechbox/user_preferences"
  require_relative "lib/discourse_mechbox/guardian_extension"
  require_relative "lib/discourse_mechbox/formula_evaluator"
  require_relative "lib/discourse_mechbox/bolt_preload_calculator"
  require_relative "lib/discourse_mechbox/thread_calculator"
  require_relative "lib/discourse_mechbox/key_calculator"
  require_relative "lib/discourse_mechbox/bolt_group_calculator"
  require_relative "lib/discourse_mechbox/weld_calculator"
  require_relative "lib/discourse_mechbox/spring_calculator"
  require_relative "lib/discourse_mechbox/clutch_calculator"
  require_relative "lib/discourse_mechbox/belt_calculator"
  require_relative "lib/discourse_mechbox/chain_calculator"
  require_relative "lib/discourse_mechbox/tol_convert_calculator"
  require_relative "lib/discourse_mechbox/sigma_analysis_calculator"
  require_relative "lib/discourse_mechbox/fit_calculator"
  require_relative "lib/discourse_mechbox/distribution_chart_calculator"
  require_relative "lib/discourse_mechbox/thermal_expansion_calculator"
  require_relative "lib/discourse_mechbox/interference_fit_calculator"
  require_relative "lib/discourse_mechbox/bearing_calculator"
  require_relative "lib/discourse_mechbox/shaft_calculator"
  require_relative "lib/discourse_mechbox/gear_calculator"
  require_relative "lib/discourse_mechbox/fatigue_calculator"
  require_relative "lib/discourse_mechbox/beam_calculator"
  require_relative "lib/discourse_mechbox/structural_calculator"
  require_relative "lib/discourse_mechbox/sheet_metal_calculator"
  require_relative "lib/discourse_mechbox/cylinder_calculator"
  require_relative "lib/discourse_mechbox/o_ring_calculator"
  require_relative "lib/discourse_mechbox/manufacturing_calculator"
  require_relative "lib/discourse_mechbox/materials_library"
  require_relative "lib/discourse_mechbox/materials_calculator"
  require_relative "lib/discourse_mechbox/heat_treatment_calculator"
  require_relative "lib/discourse_mechbox/material_selection_calculator"
  require_relative "lib/discourse_mechbox/thread_standards_library"
  require_relative "lib/discourse_mechbox/thread_table_calculator"
  require_relative "lib/discourse_mechbox/calculator_registry"
  require_relative "app/services/discourse_mechbox/metadata_builder"
  require_relative "app/services/discourse_mechbox/calculation_runner"
  require_relative "app/controllers/discourse_mechbox/base_controller"
  require_relative "app/controllers/discourse_mechbox/skeleton_controller"
  require_relative "app/controllers/discourse_mechbox/metadata_controller"
  require_relative "app/controllers/discourse_mechbox/tools_controller"
  require_relative "app/controllers/discourse_mechbox/calculations_controller"
  require_relative "app/controllers/discourse_mechbox/mechbox_page_controller"

  Discourse::Application.routes.append do
    mount ::DiscourseMechbox::Engine, at: "/mechbox/api"

    get "/mechbox(/*rest)" => "discourse_mechbox/mechbox_page#index",
        constraints: ->(request) { request.format.nil? || request.format.html? }
  end

  reloadable_patch { Guardian.prepend(DiscourseMechbox::GuardianExtension) }
end
