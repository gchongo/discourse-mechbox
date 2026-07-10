# frozen_string_literal: true

module DiscourseMechbox
  class Engine < ::Rails::Engine
    engine_name PLUGIN_NAME
    isolate_namespace DiscourseMechbox
  end
end
