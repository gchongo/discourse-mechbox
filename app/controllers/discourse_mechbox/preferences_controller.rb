# frozen_string_literal: true

module DiscourseMechbox
  class PreferencesController < BaseController
    def show
      return unless require_api_feature!(:preferences)

      render json: {
        preferences: UserPreferences.fetch(current_user),
        effective_unit_system: UserPreferences.effective_unit_system(current_user),
      }
    end

    def update
      return unless require_api_feature!(:preferences)

      preferences = UserPreferences.update!(current_user, preference_params)
      render json: {
        preferences:,
        effective_unit_system: UserPreferences.effective_unit_system(current_user),
      }
    end

    private

    def preference_params
      params.require(:preferences).permit(:unit_system, :favorite_layout, recent_tool_ids: [])
    end
  end
end
