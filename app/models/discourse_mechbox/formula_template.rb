# frozen_string_literal: true

module DiscourseMechbox
  class FormulaTemplate < ::ActiveRecord::Base
    self.table_name = "mechbox_formula_templates"

    belongs_to :created_by, class_name: "User"
    has_many :template_versions,
             class_name: "DiscourseMechbox::TemplateVersion",
             foreign_key: :formula_template_id,
             dependent: :delete_all
    has_many :calculation_records,
             class_name: "DiscourseMechbox::CalculationRecord",
             foreign_key: :formula_template_id,
             dependent: :nullify

    validates :name, presence: true
    validates :tool_id, presence: true
    validates :formula, presence: true

    scope :active, -> { where(active: true) }
    scope :recent, -> { order(updated_at: :desc, id: :desc) }

    def self.list_for(guardian)
      relation = active.recent
      return relation if guardian.is_admin?

      group_ids = guardian.user&.group_ids || []
      if group_ids.empty?
        relation.where("cardinality(visible_group_ids) = 0")
      else
        relation.where(
          "cardinality(visible_group_ids) = 0 OR visible_group_ids && ARRAY[?]::integer[]",
          group_ids,
        )
      end
    end

    def visible_to?(guardian)
      return false if !active?
      return true if guardian.is_admin?
      return false if !guardian.can_use_mechbox?
      return true if visible_group_ids.blank?

      guardian.user&.in_any_groups?(visible_group_ids)
    end

    def snapshot
      {
        name:,
        description:,
        tool_id:,
        category:,
        formula:,
        default_inputs:,
        output_schema:,
        visible_group_ids:,
        active:,
      }
    end

    def record_version!(changed_by:, change_note: "")
      template_versions.create!(snapshot:, changed_by:, change_note:)
    end
  end
end
