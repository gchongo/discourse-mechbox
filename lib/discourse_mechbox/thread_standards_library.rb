# frozen_string_literal: true

require "json"

module DiscourseMechbox
  # Pre-expanded thread standards table exported from MechBox thread-standards.
  module ThreadStandardsLibrary
    DATA_PATH = File.expand_path("data/thread_standards.json", __dir__)

    module_function

    def payload
      @payload ||= JSON.parse(File.read(DATA_PATH)).freeze
    end

    def all
      payload["rows"]
    end

    def systems
      payload["systems"]
    end

    def total_count
      payload["total_count"] || all.size
    end

    def find(id)
      all.find { |r| r["id"] == id.to_s }
    end

    def search(query: nil, system: nil, sub_series: nil, priority: nil, diameter_min: nil, diameter_max: nil)
      q = query.to_s.strip.downcase
      sys = system.to_s.strip
      sub = sub_series.to_s.strip
      pri = priority.to_s.strip
      dmin = diameter_min.nil? ? nil : Float(diameter_min)
      dmax = diameter_max.nil? ? nil : Float(diameter_max)

      all.select do |r|
        next false if sys.present? && r["system"] != sys
        next false if sub.present? && r["subSeries"].to_s != sub
        next false if pri.present? && pri != "all" && r["priority"].to_s != pri
        next false if dmin && r["nominal"].to_f < dmin
        next false if dmax && r["nominal"].to_f > dmax
        next true if q.blank?

        haystack = [
          r["id"],
          r["designation"],
          r["system"],
          r["subSeries"],
          r["standardRef"],
          r["usageKey"],
        ].join(" ").downcase
        haystack.include?(q)
      end
    end
  end
end
