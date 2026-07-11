# frozen_string_literal: true

module DiscourseMechbox
  class FavoriteToolSerializer < ::ApplicationSerializer
    attributes :id, :tool_id, :created_at
  end
end
