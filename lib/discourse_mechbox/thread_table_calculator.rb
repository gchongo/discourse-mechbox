# frozen_string_literal: true

module DiscourseMechbox
  # Read-only thread standards lookup (catalog browse / filter).
  class ThreadTableCalculator
    class Error < StandardError
    end

    PAGE_SIZE = 25

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      query = @inputs["query"].to_s
      system = @inputs["system"].to_s
      sub_series = (@inputs["sub_series"] || @inputs["subSeries"]).to_s
      priority = @inputs["priority"].to_s
      diameter_min = optional_number("diameter_min", aliases: %w[diameterMin])
      diameter_max = optional_number("diameter_max", aliases: %w[diameterMax])
      row_id = (@inputs["row_id"] || @inputs["rowId"]).to_s.presence
      page = positive_integer("page") || 1

      if row_id
        row = ThreadStandardsLibrary.find(row_id)
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "row_id") if row.nil?

        return {
          "row" => row,
          "rows" => [row],
          "systems" => ThreadStandardsLibrary.systems,
          "count" => 1,
          "matched_count" => 1,
          "total_count" => ThreadStandardsLibrary.total_count,
          "page" => 1,
          "page_count" => 1,
        }
      end

      matched =
        ThreadStandardsLibrary.search(
          query: query,
          system: system.presence,
          sub_series: sub_series.presence,
          priority: priority.presence,
          diameter_min: diameter_min,
          diameter_max: diameter_max,
        )
      page_count = [(matched.size.to_f / PAGE_SIZE).ceil, 1].max
      page = [page, page_count].min
      rows = matched.slice((page - 1) * PAGE_SIZE, PAGE_SIZE) || []

      {
        "query" => query,
        "system" => system.presence,
        "sub_series" => sub_series.presence,
        "priority" => priority.presence,
        "diameter_min" => diameter_min,
        "diameter_max" => diameter_max,
        "rows" => rows,
        "systems" => ThreadStandardsLibrary.systems,
        "count" => rows.size,
        "matched_count" => matched.size,
        "total_count" => ThreadStandardsLibrary.total_count,
        "page" => page,
        "page_count" => page_count,
      }
    end

    private

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end

    def positive_integer(key)
      raw = @inputs[key]
      return nil if raw.nil? || raw == ""

      value = Integer(raw)
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key) if value < 1

      value
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end
  end
end
