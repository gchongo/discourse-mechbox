# frozen_string_literal: true

class CreateDiscourseMechboxTables < ActiveRecord::Migration[7.0]
  def change
    create_table :mechbox_formula_templates do |t|
      t.string :name, null: false
      t.text :description
      t.string :tool_id, null: false
      t.string :category
      t.jsonb :formula, null: false, default: {}
      t.jsonb :default_inputs, null: false, default: {}
      t.jsonb :output_schema, null: false, default: {}
      t.integer :visible_group_ids, array: true, null: false, default: []
      t.integer :created_by_id, null: false
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    add_index :mechbox_formula_templates, :tool_id
    add_index :mechbox_formula_templates, :created_by_id
    add_index :mechbox_formula_templates, :active
    add_index :mechbox_formula_templates, :visible_group_ids, using: :gin

    create_table :mechbox_template_versions do |t|
      t.integer :formula_template_id, null: false
      t.integer :changed_by_id, null: false
      t.jsonb :snapshot, null: false, default: {}
      t.text :change_note
      t.timestamps
    end

    add_index :mechbox_template_versions, :formula_template_id
    add_index :mechbox_template_versions, :changed_by_id

    create_table :mechbox_calculation_records do |t|
      t.integer :user_id, null: false
      t.string :tool_id, null: false
      t.integer :formula_template_id
      t.string :title
      t.jsonb :inputs, null: false, default: {}
      t.jsonb :outputs, null: false, default: {}
      t.string :unit_system
      t.timestamps
    end

    add_index :mechbox_calculation_records, :user_id
    add_index :mechbox_calculation_records, :tool_id
    add_index :mechbox_calculation_records, :formula_template_id
    add_index :mechbox_calculation_records, [:user_id, :created_at]

    create_table :mechbox_favorite_tools do |t|
      t.integer :user_id, null: false
      t.string :tool_id, null: false
      t.timestamps
    end

    add_index :mechbox_favorite_tools, :user_id
    add_index :mechbox_favorite_tools, [:user_id, :tool_id], unique: true
  end
end
