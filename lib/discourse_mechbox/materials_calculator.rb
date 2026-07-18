# frozen_string_literal: true

module DiscourseMechbox
  # Read-only materials library browse / temperature allowable lookup.
  class MaterialsCalculator
    class Error < StandardError
    end

    def self.calculate(inputs)
      new(inputs).calculate
    end

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def calculate
      calc_mode = normalize_mode(@inputs["calc_mode"] || @inputs["calcMode"])
      temp_c = optional_number("temp_c", aliases: %w[tempC operating_temp_c]) || 20.0
      query = @inputs["query"].to_s
      category = @inputs["category"].to_s
      material_id = (@inputs["material_id"] || @inputs["materialId"]).to_s.presence

      if material_id
        material = MaterialsLibrary.find(material_id)
        raise Error, I18n.t("mechbox.errors.invalid_input", field: "material_id") if material.nil?

        row = MaterialsLibrary.with_allowable(material, temp_c)
        return {
          "calc_mode" => calc_mode,
          "temp_c" => temp_c,
          "material" => row,
          "materials" => [row],
          "categories" => MaterialsLibrary.categories,
          "count" => 1,
          "total_count" => MaterialsLibrary.all.size,
        }
      end

      rows = MaterialsLibrary.search(query:, category: category.presence)
      materials = rows.map { |m| MaterialsLibrary.with_allowable(m, temp_c) }

      {
        "calc_mode" => calc_mode,
        "temp_c" => temp_c,
        "query" => query,
        "category" => category.presence,
        "materials" => materials,
        "categories" => MaterialsLibrary.categories,
        "count" => materials.size,
        "total_count" => MaterialsLibrary.all.size,
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
