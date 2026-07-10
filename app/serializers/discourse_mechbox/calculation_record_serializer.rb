# frozen_string_literal: true

module DiscourseMechbox
  class CalculationRecordSerializer < ::ApplicationSerializer
    attributes :id,
               :tool_id,
               :formula_template_id,
               :title,
               :inputs,
               :outputs,
               :unit_system,
               :created_at,
               :updated_at
  end
end
