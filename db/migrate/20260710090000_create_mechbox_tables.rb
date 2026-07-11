# frozen_string_literal: true

class CreateMechboxTables < ActiveRecord::Migration::Current
  def change
    create_table :mechbox_formula_templates do |t|
      t.string :name, null: false
      t.text :description, null: false, default: ""
      t.string :tool_id, null: false
      t.string :category, null: false, default: ""
      t.jsonb :formula, null: false, default: {}
      t.jsonb :default_inputs, null: false, default: {}
      t.jsonb :output_schema, null: false, default: {}
      t.integer :visible_group_ids, array: true, null: false, default: []
      t.integer :created_by_id, null: false
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :mechbox_formula_templates, %i[tool_id active]
    add_index :mechbox_formula_templates, :created_by_id

    create_table :mechbox_template_versions do |t|
      t.bigint :formula_template_id, null: false
      t.jsonb :snapshot, null: false, default: {}
      t.integer :changed_by_id, null: false
      t.text :change_note, null: false, default: ""

      t.timestamps
    end

    add_index :mechbox_template_versions, %i[formula_template_id created_at]
    add_index :mechbox_template_versions, :changed_by_id

    create_table :mechbox_calculation_records do |t|
      t.integer :user_id, null: false
      t.string :tool_id, null: false
      t.bigint :formula_template_id
      t.string :title, null: false, default: ""
      t.jsonb :inputs, null: false, default: {}
      t.jsonb :outputs, null: false, default: {}
      t.string :unit_system, null: false, default: ""

      t.timestamps
    end

    add_index :mechbox_calculation_records, %i[user_id created_at]
    add_index :mechbox_calculation_records, :tool_id
    add_index :mechbox_calculation_records, :formula_template_id

    create_table :mechbox_favorite_tools do |t|
      t.integer :user_id, null: false
      t.string :tool_id, null: false

      t.timestamps
    end

    add_index :mechbox_favorite_tools, %i[user_id tool_id], unique: true
  end
end
