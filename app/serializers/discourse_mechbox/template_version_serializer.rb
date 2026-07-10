# frozen_string_literal: true

module DiscourseMechbox
  class TemplateVersionSerializer < ::ApplicationSerializer
    attributes :id,
               :formula_template_id,
               :snapshot,
               :changed_by_id,
               :changed_by_username,
               :change_note,
               :created_at

    def changed_by_username
      object.changed_by&.username
    end
  end
end
