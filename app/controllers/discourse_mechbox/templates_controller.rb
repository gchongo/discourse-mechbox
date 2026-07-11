# frozen_string_literal: true

module DiscourseMechbox
  class TemplatesController < BaseController
    before_action :ensure_can_manage_templates!, only: %i[create update destroy]
    before_action :fetch_template, only: %i[show update destroy]

    def index
      return unless require_api_feature!(:templates)

      templates = FormulaTemplate.list_for(guardian)
      render json: serialize_data(templates, FormulaTemplateSerializer)
    end

    def show
      return unless require_api_feature!(:templates)

      render json: FormulaTemplateSerializer.new(@template, root: false)
    end

    def create
      return unless require_api_feature!(:templates)

      template = TemplateManager.create!(guardian:, params:)
      render json: FormulaTemplateSerializer.new(template, root: false), status: :created
    end

    def update
      return unless require_api_feature!(:templates)

      template = TemplateManager.update!(guardian:, template: @template, params:)
      render json: FormulaTemplateSerializer.new(template, root: false)
    end

    def destroy
      return unless require_api_feature!(:templates)

      TemplateManager.destroy!(template: @template)
      head :no_content
    end

    private

    def fetch_template
      @template = FormulaTemplate.find_by(id: params[:id])
      raise Discourse::NotFound if @template.blank?

      if action_name.in?(%w[show]) && !guardian.can_use_mechbox_template?(@template)
        raise Discourse::InvalidAccess
      end

      if action_name.in?(%w[update destroy]) && !guardian.can_manage_mechbox_templates?
        raise Discourse::InvalidAccess
      end
    end
  end
end
