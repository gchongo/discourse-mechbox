# frozen_string_literal: true

module DiscourseMechbox
  class RecordsController < BaseController
    def index
      return unless require_api_feature!(:records_index)

      records, meta = paginated_records
      render json: {
        records: serialize_records(records),
        meta:,
      }
    end

    def search
      return unless require_api_feature!(:records_search)

      records, meta = paginated_records
      render json: {
        records: serialize_records(records),
        meta:,
      }
    end

    def show
      return unless require_api_feature!(:records_show)

      record = fetch_user_record!(params[:id])
      render json: CalculationRecordSerializer.new(record, root: false)
    end

    def destroy
      return unless require_api_feature!(:records_destroy)

      record = fetch_user_record!(params[:id])
      record.destroy!
      head :no_content
    end

    def bulk_destroy
      return unless require_api_feature!(:records_bulk_destroy)

      ids = Array(params[:ids]).map(&:to_i).uniq
      scope = CalculationRecord.for_user(current_user).where(id: ids)
      deleted_count = scope.destroy_all.size
      render json: { deleted_count: }
    end

    private

    def paginated_records
      pagination = mechbox_pagination
      scope =
        CalculationRecord.search(
          user: current_user,
          tool_id: params[:tool_id],
          query: params[:q] || params[:query],
        )
      total_count = scope.count
      records = scope.offset(pagination[:offset]).limit(pagination[:limit])
      meta = pagination_meta(total_count:, page: pagination[:page], limit: pagination[:limit])
      [records, meta]
    end

    def serialize_records(records)
      serialize_data(records, CalculationRecordSerializer)
    end
  end
end
