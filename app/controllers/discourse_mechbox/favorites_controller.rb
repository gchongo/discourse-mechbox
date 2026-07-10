# frozen_string_literal: true

module DiscourseMechbox
  class FavoritesController < BaseController
    def index
      favorites = FavoriteTool.where(user_id: current_user.id).order(created_at: :desc)
      render json: serialize_data(favorites, FavoriteToolSerializer)
    end

    def create
      tool_id = params.require(:tool_id).to_s
      raise Discourse::InvalidParameters.new(:tool_id) if !favorite_tool_allowed?(tool_id)

      favorite = FavoriteTool.find_or_create_by!(user_id: current_user.id, tool_id:)
      render json: FavoriteToolSerializer.new(favorite, root: false), status: :created
    end

    def destroy
      favorite = FavoriteTool.find_by(user_id: current_user.id, tool_id: params[:tool_id])
      raise Discourse::NotFound if favorite.blank?

      favorite.destroy!
      head :no_content
    end

    private

    def favorite_tool_allowed?(tool_id)
      ToolCatalog.known_tool_id?(tool_id) ||
        FormulaTemplate.list_for(guardian).exists?(tool_id:)
    end
  end
end
