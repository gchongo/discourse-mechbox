# frozen_string_literal: true

module DiscourseMechbox
  class CalculationRecord < ::ActiveRecord::Base
    self.table_name = "mechbox_calculation_records"

    belongs_to :user
    belongs_to :formula_template,
               class_name: "DiscourseMechbox::FormulaTemplate",
               optional: true

    validates :tool_id, presence: true
    validates :inputs, presence: true
    validates :outputs, presence: true

    scope :recent, -> { order(created_at: :desc, id: :desc) }
    scope :for_user, ->(user) { where(user_id: user.id) }
    scope :for_tool, ->(tool_id) { where(tool_id:) if tool_id.present? }
    scope :title_matches,
          ->(query) {
            query.present? ? where("title ILIKE ?", "%#{sanitize_sql_like(query.to_s)}%") : all
          }

    def self.search(user:, tool_id: nil, query: nil)
      for_user(user).for_tool(tool_id).title_matches(query).recent
    end
  end
end
