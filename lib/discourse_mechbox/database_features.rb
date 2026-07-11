# frozen_string_literal: true

module DiscourseMechbox
  module DatabaseFeatures
    class << self
      def available?
        return @available if defined?(@available)

        @available =
          ActiveRecord::Base.connection.table_exists?(:mechbox_calculation_records)
      rescue StandardError
        @available = false
      end
    end
  end
end
