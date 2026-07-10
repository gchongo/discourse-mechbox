# frozen_string_literal: true

module DiscourseMechbox
  class RecordCreator
    class << self
      def create!(user:, tool_id:, inputs:, outputs:, unit_system:, title: nil, formula_template: nil)
        enforce_limit!(user)

        CalculationRecord.create!(
          user:,
          tool_id:,
          formula_template:,
          title: title.to_s,
          inputs:,
          outputs:,
          unit_system: unit_system.to_s,
        )
      end

      private

      def enforce_limit!(user)
        limit = SiteSetting.mechbox_max_records_per_user.to_i
        return if limit <= 0

        count = CalculationRecord.where(user_id: user.id).count
        if count >= limit
          raise CalculatorRegistry::Error, I18n.t("mechbox.errors.record_limit_reached", limit:)
        end
      end
    end
  end
end
