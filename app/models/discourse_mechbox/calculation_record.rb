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
  end
end
