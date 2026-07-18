# frozen_string_literal: true

module DiscourseMechbox
  # Read-only thread standards lookup (catalog browse / filter).
  class ThreadTableCalculator
    class Error < StandardError
    end

    MAX_ROWS = 200

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      query = @inputs["query"].to_s
      system = @inputs["system"].to_s
      sub_series = (@inputs["sub_series"] || @inputs["subSeries"]).to_s
      diameter_min = optional_number("diameter_min", aliases: %w[diameterMin])
      diameter_max = optional_number("diameter_max", aliases: %w[diameterMax])
      row_id = (@inputs["row_id"] || @inputs["rowId"]).to_s.presence

      if row_id
        row = ThreadStandardsLibrary.find(row_id)
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "row_id") if row.nil?

        return {
          "calc_mode" => calc_mode,
          "row" => row,
          "rows" => [row],
          "systems" => ThreadStandardsLibrary.systems,
          "count" => 1,
          "matched_count" => 1,
          "total_count" => ThreadStandardsLibrary.total_count,
          "truncated" => false,
        }
      end

      matched =
        ThreadStandardsLibrary.search(
          query: query,
          system: system.presence,
          sub_series: sub_series.presence,
          diameter_min: diameter_min,
          diameter_max: diameter_max,
        )
      limit = calc_mode == "simple" ? 50 : MAX_ROWS
      rows = matched.first(limit)

      {
        "calc_mode" => calc_mode,
        "query" => query,
        "system" => system.presence,
        "sub_series" => sub_series.presence,
        "diameter_min" => diameter_min,
        "diameter_max" => diameter_max,
        "rows" => rows,
        "systems" => ThreadStandardsLibrary.systems,
        "count" => rows.size,
        "matched_count" => matched.size,
        "total_count" => ThreadStandardsLibrary.total_count,
        "truncated" => matched.size > rows.size,
      }
    end

    private

    def normalize_mode(raw)
      mode = raw.to_s.presence || "simple"
      return "simple" if mode == "simple"
      return "full" if mode == "complete" || mode == "full"
      return "professional" if mode == "professional" || mode == "pro"

      raise Error, I18n.t("mechbox.errors.invalid_input", field: "calc_mode")
    end

    def optional_number(key, aliases: [])
      raw = @inputs[key]
      aliases.each { |alt| raw = @inputs[alt] if raw.nil? || raw == "" }
      return nil if raw.nil? || raw == ""

      Float(raw)
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_input", field: key)
    end
  end
end
