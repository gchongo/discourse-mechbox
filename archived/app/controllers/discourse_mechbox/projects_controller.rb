# frozen_string_literal: true

module DiscourseMechbox
  class ProjectsController < BaseController
    def index
      return unless require_api_feature!(:projects)

      render_json_error I18n.t("mechbox.errors.projects_not_implemented"), status: 501
    end

    def show
      return unless require_api_feature!(:projects)

      render_json_error I18n.t("mechbox.errors.projects_not_implemented"), status: 501
    end

    def create
      return unless require_api_feature!(:projects)

      render_json_error I18n.t("mechbox.errors.projects_not_implemented"), status: 501
    end

    def update
      return unless require_api_feature!(:projects)

      render_json_error I18n.t("mechbox.errors.projects_not_implemented"), status: 501
    end

    def destroy
      return unless require_api_feature!(:projects)

      render_json_error I18n.t("mechbox.errors.projects_not_implemented"), status: 501
    end
  end
end
