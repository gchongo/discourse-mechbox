# frozen_string_literal: true

module DiscourseMechbox
  module Concerns
    module FeatureGate
      extend ActiveSupport::Concern

      private

      def require_api_feature!(feature)
        return true if DiscourseMechbox::ApiCapabilities.enabled?(feature)

        render_json_error I18n.t("mechbox.errors.feature_not_available", feature: feature),
                          status: 501
        false
      end
    end
  end
end
