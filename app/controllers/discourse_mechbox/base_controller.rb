# frozen_string_literal: true

module DiscourseMechbox
  class BaseController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    include DiscourseMechbox::Concerns::FeatureGate

    before_action :ensure_logged_in
    before_action :ensure_can_use_mechbox
    skip_before_action :check_xhr, raise: false

    rescue_from DiscourseMechbox::CalculatorRegistry::Error, with: :render_calculation_error
    rescue_from DiscourseMechbox::FormulaEvaluator::Error, with: :render_calculation_error

    private

    def ensure_can_use_mechbox
      raise Discourse::InvalidAccess if !guardian.can_use_mechbox?
    end

    def ensure_can_manage_templates!
      raise Discourse::InvalidAccess if !guardian.can_manage_mechbox_templates?
    end

    def render_calculation_error(exception)
      render_json_error exception.message, status: 422
    end

    def mechbox_pagination
      page = [params[:page].to_i, 1].max
      limit = params[:limit].to_i
      limit = 30 if limit <= 0
      limit = [limit, 100].min
      offset = (page - 1) * limit
      { page:, limit:, offset: }
    end

    def pagination_meta(total_count:, page:, limit:)
      {
        page:,
        limit:,
        total_count:,
        total_pages: (total_count.to_f / limit).ceil,
      }
    end

    def fetch_user_record!(id)
      record = CalculationRecord.find_by(id:)
      raise Discourse::NotFound if record.blank?
      raise Discourse::InvalidAccess if record.user_id != current_user.id && !guardian.is_admin?
      record
    end

    def fetch_visible_template!(id)
      template = FormulaTemplate.find_by(id:)
      raise Discourse::NotFound if template.blank?
      raise Discourse::InvalidAccess if !guardian.can_use_mechbox_template?(template)
      template
    end
  end
end
