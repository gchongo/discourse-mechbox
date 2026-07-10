# frozen_string_literal: true

DiscourseMechbox::Engine.routes.draw do
  # Discovery
  get "/metadata" => "metadata#show"
  get "/tools" => "tools#index"
  get "/tools/:tool_id" => "tools#show"

  # Calculation
  post "/calculate" => "calculations#create"
  post "/calculate/validate" => "calculations#validate"

  # Calculation records
  get "/records/search" => "records#search"
  delete "/records/bulk" => "records#bulk_destroy"
  get "/records" => "records#index"
  get "/records/:id" => "records#show"
  delete "/records/:id" => "records#destroy"

  # Favorites
  get "/favorites" => "favorites#index"
  post "/favorites" => "favorites#create"
  delete "/favorites/:tool_id" => "favorites#destroy"

  # Formula templates
  get "/templates" => "templates#index"
  post "/templates" => "templates#create"
  get "/templates/:template_id/versions" => "template_versions#index"
  get "/templates/:template_id/versions/:id" => "template_versions#show"
  get "/templates/:id" => "templates#show"
  put "/templates/:id" => "templates#update"
  delete "/templates/:id" => "templates#destroy"

  # User preferences (stored in user custom fields)
  get "/preferences" => "preferences#show"
  put "/preferences" => "preferences#update"

  # Client-side MechBox tools (browser calculation + optional server verification)
  post "/client_tools/:tool_id/validate" => "client_tools#validate"
  post "/client_tools/:tool_id/calculate" => "client_tools#calculate"

  # Export jobs (PDF / Excel / image) — future
  post "/exports" => "exports#create"
  get "/exports/:id" => "exports#show"

  # Topic integration — future
  post "/topic_drafts" => "topic_drafts#create"

  # Design projects / tool chains — future
  get "/projects" => "projects#index"
  post "/projects" => "projects#create"
  get "/projects/:id" => "projects#show"
  put "/projects/:id" => "projects#update"
  delete "/projects/:id" => "projects#destroy"

  namespace :admin do
    get "/stats" => "stats#show"
  end
end
