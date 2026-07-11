# frozen_string_literal: true

module DiscourseMechbox
  class ClientToolsController < BaseController
    before_action :require_client_tools_feature!

    def validate
      tool_id = params.require(:tool_id)
      ensure_client_tool!(tool_id)
      render_json_error I18n.t("mechbox.errors.client_tool_not_implemented", tool_id:), status: 501
    end

    def calculate
      tool_id = params.require(:tool_id)
      ensure_client_tool!(tool_id)
      render_json_error I18n.t("mechbox.errors.client_tool_not_implemented", tool_id:), status: 501
    end

    private

    def require_client_tools_feature!
      require_api_feature!(:client_tools)
    end

    def ensure_client_tool!(tool_id)
      raise Discourse::NotFound if ToolCatalog.find_client(tool_id).blank?
    end
  end
end
