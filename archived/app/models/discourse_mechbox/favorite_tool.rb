# frozen_string_literal: true

module DiscourseMechbox
  class FavoriteTool < ::ActiveRecord::Base
    self.table_name = "mechbox_favorite_tools"

    belongs_to :user

    validates :tool_id, presence: true, uniqueness: { scope: :user_id }
  end
end
