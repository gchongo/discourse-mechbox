# frozen_string_literal: true

module DiscourseMechbox
  class TemplateManager
    PERMITTED_ATTRS = %i[
      name
      description
      tool_id
      category
      formula
      default_inputs
      output_schema
      visible_group_ids
      active
      change_note
    ].freeze

    class << self
      def create!(guardian:, params:)
        attrs = permitted_attributes(params)
        template =
          FormulaTemplate.create!(
            attrs.except(:change_note).merge(created_by_id: guardian.user.id),
          )
        template.record_version!(changed_by: guardian.user, change_note: attrs[:change_note].to_s)
        template
      end

      def update!(guardian:, template:, params:)
        attrs = permitted_attributes(params)
        template.update!(attrs.except(:change_note))
        template.record_version!(changed_by: guardian.user, change_note: attrs[:change_note].to_s)
        template
      end

      def destroy!(template:)
        template.update!(active: false)
        template
      end

      private

      def permitted_attributes(params)
        permitted_keys = [
          *PERMITTED_ATTRS,
          { formula: {} },
          { default_inputs: {} },
          { output_schema: {} },
          { visible_group_ids: [] },
        ]

        raw =
          if params[:template].present?
            params.require(:template).permit(*permitted_keys)
          else
            params.permit(*permitted_keys)
          end

        raw.to_h.symbolize_keys
      end
    end
  end
end
