# frozen_string_literal: true

module DiscourseMechbox
  class TemplateVersion < ::ActiveRecord::Base
    self.table_name = "mechbox_template_versions"

    belongs_to :formula_template, class_name: "DiscourseMechbox::FormulaTemplate"
    belongs_to :changed_by, class_name: "User"

    validates :snapshot, presence: true
  end
end
