# frozen_string_literal: true

module DiscourseMechbox
  class UserPreferences
    FIELD = "mechbox_preferences"

    ALLOWED_KEYS = %w[unit_system favorite_layout recent_tool_ids].freeze

    class << self
      def fetch(user)
        stored = parse(user.custom_fields[FIELD])
        defaults.merge(stored).slice(*defaults.keys)
      end

      def update!(user, attrs)
        attrs = attrs.to_h.stringify_keys.slice(*ALLOWED_KEYS)
        merged = fetch(user).merge(attrs).compact
        user.custom_fields[FIELD] = merged.to_json
        user.save_custom_fields
        merged
      end

      def effective_unit_system(user)
        pref = fetch(user)["unit_system"]
        return pref if %w[metric imperial].include?(pref)

        SiteSetting.mechbox_default_unit_system
      end

      private

      def defaults
        {
          "unit_system" => nil,
          "favorite_layout" => "grid",
          "recent_tool_ids" => [],
        }
      end

      def parse(raw)
        return {} if raw.blank?

        JSON.parse(raw)
      rescue JSON::ParserError
        {}
      end
    end
  end
end
