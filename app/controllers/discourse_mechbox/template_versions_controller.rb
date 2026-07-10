# frozen_string_literal: true

module DiscourseMechbox
  class TemplateVersionsController < BaseController
    before_action :fetch_template

    def index
      return unless require_api_feature!(:template_versions)

      versions = @template.template_versions.order(created_at: :desc, id: :desc)
      pagination = mechbox_pagination
      total_count = versions.count
      page =
        versions.offset(pagination[:offset]).limit(pagination[:limit])

      render json: {
        versions: serialize_data(page, TemplateVersionSerializer),
        meta: pagination_meta(total_count:, page: pagination[:page], limit: pagination[:limit]),
      }
    end

    def show
      return unless require_api_feature!(:template_versions)

      version = @template.template_versions.find_by(id: params[:id])
      raise Discourse::NotFound if version.blank?

      render json: TemplateVersionSerializer.new(version, root: false)
    end

    private

    def fetch_template
      @template = FormulaTemplate.find_by(id: params[:template_id])
      raise Discourse::NotFound if @template.blank?
      raise Discourse::InvalidAccess if !guardian.can_manage_mechbox_templates?
    end
  end
end
