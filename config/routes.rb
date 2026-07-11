# frozen_string_literal: true

DiscourseMechbox::Engine.routes.draw do
  get "/status" => "skeleton#status"
  get "/metadata" => "metadata#show"

  get "/tools" => "tools#index"
  get "/tools/:tool_id" => "tools#show"
  post "/calculate" => "skeleton#not_implemented", defaults: { feature: "calculate" }
  post "/calculate/validate" => "skeleton#not_implemented", defaults: { feature: "calculate_validate" }
  get "/records/search" => "skeleton#not_implemented", defaults: { feature: "records_search" }
  delete "/records/bulk" => "skeleton#not_implemented", defaults: { feature: "records_bulk_destroy" }
  get "/records" => "skeleton#not_implemented", defaults: { feature: "records_index" }
  get "/records/:id" => "skeleton#not_implemented", defaults: { feature: "records_show" }
  delete "/records/:id" => "skeleton#not_implemented", defaults: { feature: "records_destroy" }
  get "/favorites" => "skeleton#not_implemented", defaults: { feature: "favorites_index" }
  post "/favorites" => "skeleton#not_implemented", defaults: { feature: "favorites_create" }
  delete "/favorites/:tool_id" => "skeleton#not_implemented", defaults: { feature: "favorites_destroy" }
  get "/templates" => "skeleton#not_implemented", defaults: { feature: "templates_index" }
  post "/templates" => "skeleton#not_implemented", defaults: { feature: "templates_create" }
  get "/templates/:template_id/versions" => "skeleton#not_implemented",
                                         defaults: {
                                           feature: "template_versions_index",
                                         }
  get "/templates/:template_id/versions/:id" => "skeleton#not_implemented",
                                                defaults: {
                                                  feature: "template_versions_show",
                                                }
  get "/templates/:id" => "skeleton#not_implemented", defaults: { feature: "templates_show" }
  put "/templates/:id" => "skeleton#not_implemented", defaults: { feature: "templates_update" }
  delete "/templates/:id" => "skeleton#not_implemented", defaults: { feature: "templates_destroy" }
  get "/preferences" => "skeleton#not_implemented", defaults: { feature: "preferences_show" }
  put "/preferences" => "skeleton#not_implemented", defaults: { feature: "preferences_update" }
  post "/client_tools/:tool_id/validate" => "skeleton#not_implemented",
                                            defaults: {
                                              feature: "client_tools_validate",
                                            }
  post "/client_tools/:tool_id/calculate" => "skeleton#not_implemented",
                                             defaults: {
                                               feature: "client_tools_calculate",
                                             }
  post "/exports" => "skeleton#not_implemented", defaults: { feature: "exports_create" }
  get "/exports/:id" => "skeleton#not_implemented", defaults: { feature: "exports_show" }
  post "/topic_drafts" => "skeleton#not_implemented", defaults: { feature: "topic_drafts_create" }
  get "/projects" => "skeleton#not_implemented", defaults: { feature: "projects_index" }
  post "/projects" => "skeleton#not_implemented", defaults: { feature: "projects_create" }
  get "/projects/:id" => "skeleton#not_implemented", defaults: { feature: "projects_show" }
  put "/projects/:id" => "skeleton#not_implemented", defaults: { feature: "projects_update" }
  delete "/projects/:id" => "skeleton#not_implemented", defaults: { feature: "projects_destroy" }
  get "/admin/stats" => "skeleton#not_implemented", defaults: { feature: "admin_stats" }
end

Discourse::Application.routes.append { mount ::DiscourseMechbox::Engine, at: "/mechbox/api" }
