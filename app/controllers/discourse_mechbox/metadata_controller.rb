# frozen_string_literal: true

module DiscourseMechbox
  class MetadataController < BaseController
    def show
      render json: MetadataBuilder.build(guardian:)
    end
  end
end
