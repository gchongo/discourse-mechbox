# frozen_string_literal: true

module DiscourseMechbox
  class MetadataController < BaseController
    def show
      return unless require_api_feature!(:metadata)

      render json: MetadataBuilder.build(guardian:)
    end
  end
end
