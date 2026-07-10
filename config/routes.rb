# frozen_string_literal: true

DiscourseMechbox::Engine.routes.draw do
  get "/metadata" => "metadata#show"

  post "/calculate" => "calculations#create"

  get "/records" => "records#index"
  get "/records/:id" => "records#show"
  delete "/records/:id" => "records#destroy"

  get "/favorites" => "favorites#index"
  post "/favorites" => "favorites#create"
  delete "/favorites/:tool_id" => "favorites#destroy"

  get "/templates" => "templates#index"
  post "/templates" => "templates#create"
  put "/templates/:id" => "templates#update"
  delete "/templates/:id" => "templates#destroy"
end
