# frozen_string_literal: true

module DiscourseMechbox
  class FormulaTemplateSerializer < ::ApplicationSerializer
    attributes :id,
               :name,
               :description,
               :tool_id,
               :category,
               :formula,
               :default_inputs,
               :output_schema,
               :visible_group_ids,
               :created_by_id,
               :created_by_username,
               :active,
               :created_at,
               :updated_at

    def created_by_username
      object.created_by&.username
    end
  end
end
