# frozen_string_literal: true

require "json"

module DiscourseMechbox
  # Shared materials table ported from MechBox/src/constants/materials.js (56 entries).
  module MaterialsLibrary
    DATA_PATH = File.expand_path("data/materials.json", __dir__)

    module_function

    def all
      @all ||= JSON.parse(File.read(DATA_PATH)).freeze
    end

    def find(id)
      all.find { |m| m["id"] == id.to_s }
    end

    def categories
      all.map { |m| m["category"] }.uniq
    end

    def search(query: nil, category: nil)
      q = query.to_s.strip.downcase
      cat = category.to_s.strip
      all.select do |m|
        next false if cat.present? && m["category"] != cat

        next true if q.blank?

        m["name"].to_s.downcase.include?(q) || m["category"].to_s.downcase.include?(q) ||
          m["id"].to_s.include?(q)
      end
    end

    # Temperature derating of allowable stress (linear, ref 20°C) — MechBox getAllowableAtTemp.
    def allowable_at_temp(material, temp_c = 20.0, ref_temp: 20.0)
      return nil if material.nil?

      temp = Float(temp_c)
      factor = temp <= ref_temp ? 1.0 : [0.4, 1.0 - (temp - ref_temp) * 0.003].max
      {
        "sigma_allow_mpa" => (material["sigma_allow"].to_f * factor).round,
        "tau_allow_mpa" => (material["tau_allow"].to_f * factor).round,
        "factor" => factor,
        "temp_c" => temp,
      }
    end

    def with_allowable(material, temp_c = 20.0)
      allow = allowable_at_temp(material, temp_c)
      material.merge(
        "sigma_allow_at_temp_mpa" => allow["sigma_allow_mpa"],
        "tau_allow_at_temp_mpa" => allow["tau_allow_mpa"],
        "temp_factor" => allow["factor"],
        "temp_c" => allow["temp_c"],
        "E" => material["e_mpa"] || material["E"],
        "G" => material["g_mpa"] || material["G"],
      )
    end
  end
end
