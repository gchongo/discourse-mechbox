# frozen_string_literal: true

class NormalizeDiscourseMechboxSchema < ActiveRecord::Migration[8.0]
  def up
    return if !table_exists?(:mechbox_formula_templates)

    change_column_default :mechbox_formula_templates, :description, from: nil, to: ""
    change_column_default :mechbox_formula_templates, :category, from: nil, to: ""
    change_column_null :mechbox_formula_templates, :description, false, ""
    change_column_null :mechbox_formula_templates, :category, false, ""
    add_index :mechbox_formula_templates, %i[tool_id active], if_not_exists: true

    if table_exists?(:mechbox_template_versions)
      change_column :mechbox_template_versions, :formula_template_id, :bigint
      change_column_default :mechbox_template_versions, :change_note, from: nil, to: ""
      change_column_null :mechbox_template_versions, :change_note, false, ""
      add_index :mechbox_template_versions, %i[formula_template_id created_at], if_not_exists: true
    end

    if table_exists?(:mechbox_calculation_records)
      change_column :mechbox_calculation_records, :formula_template_id, :bigint
      change_column_default :mechbox_calculation_records, :title, from: nil, to: ""
      change_column_default :mechbox_calculation_records, :unit_system, from: nil, to: ""
      change_column_null :mechbox_calculation_records, :title, false, ""
      change_column_null :mechbox_calculation_records, :unit_system, false, ""
      add_index :mechbox_calculation_records, %i[user_id tool_id created_at], if_not_exists: true
    end

    if table_exists?(:mechbox_favorite_tools)
      add_index :mechbox_favorite_tools, :created_at, if_not_exists: true
    end
  end

  def down
    remove_index :mechbox_favorite_tools, :created_at if index_exists?(:mechbox_favorite_tools, :created_at)

    if index_exists?(:mechbox_calculation_records, %i[user_id tool_id created_at])
      remove_index :mechbox_calculation_records, column: %i[user_id tool_id created_at]
    end

    if index_exists?(:mechbox_template_versions, %i[formula_template_id created_at])
      remove_index :mechbox_template_versions, column: %i[formula_template_id created_at]
    end

    if index_exists?(:mechbox_formula_templates, %i[tool_id active])
      remove_index :mechbox_formula_templates, column: %i[tool_id active]
    end
  end
end
