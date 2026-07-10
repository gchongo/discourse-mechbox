# frozen_string_literal: true

module DiscourseMechbox
  module GuardianExtension
    def can_use_mechbox?
      return false if !SiteSetting.mechbox_enabled

      user&.in_any_groups?(SiteSetting.mechbox_allowed_groups_map)
    end

    def can_manage_mechbox_templates?
      return false if !can_use_mechbox?
      return true if is_admin?

      authenticated? && user.in_any_groups?(SiteSetting.mechbox_template_manager_groups_map)
    end

    def can_use_mechbox_template?(formula_template)
      can_use_mechbox? && formula_template.visible_to?(self)
    end
  end
end
