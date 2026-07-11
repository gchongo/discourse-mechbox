# frozen_string_literal: true

module DiscourseMechbox
  class TopicDraftsController < BaseController
    def create
      return unless require_api_feature!(:topic_drafts)

      render_json_error I18n.t("mechbox.errors.topic_drafts_not_implemented"), status: 501
    end
  end
end
