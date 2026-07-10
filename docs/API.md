# MechBox API reference

Base path: `/mechbox/api`  
Authentication: Discourse session (logged-in user)  
CSRF: required for `POST`, `PUT`, `DELETE`

Feature availability is returned by `GET /metadata` under `capabilities`. Disabled features respond with **501**.

## Discovery

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/metadata` | ✅ | Full bootstrap payload: tools, templates, favorites, settings, capabilities |
| GET | `/tools` | ✅ | Tool catalog only |
| GET | `/tools/:tool_id` | ✅ | Single tool schema + related templates |

## Calculation

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/calculate` | ✅ | Run builtin or template calculation; optional `save_record` |
| POST | `/calculate/validate` | ✅ | Validate inputs without persisting |

## Records

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/records` | ✅ | Paginated list (`page`, `limit`, `tool_id`, `q`) |
| GET | `/records/search` | ✅ | Alias for filtered list |
| GET | `/records/:id` | ✅ | Record detail |
| DELETE | `/records/:id` | ✅ | Delete own record |
| DELETE | `/records/bulk` | ✅ | Bulk delete `{ "ids": [1, 2] }` |

## Favorites

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/favorites` | ✅ | List favorites |
| POST | `/favorites` | ✅ | `{ "tool_id": "gear_ratio" }` |
| DELETE | `/favorites/:tool_id` | ✅ | Remove favorite |

## Formula templates

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/templates` | ✅ | Visible templates |
| GET | `/templates/:id` | ✅ | Template detail |
| POST | `/templates` | ✅ | Create (managers only) |
| PUT | `/templates/:id` | ✅ | Update + version snapshot |
| DELETE | `/templates/:id` | ✅ | Soft-deactivate |
| GET | `/templates/:template_id/versions` | ✅ | Version history |
| GET | `/templates/:template_id/versions/:id` | ✅ | Version snapshot |

## User preferences

Stored in user custom field `mechbox_preferences`.

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/preferences` | ✅ | Read preferences |
| PUT | `/preferences` | ✅ | Update `{ "preferences": { ... } }` |

## Client tools (MechBox browser calculators)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/client_tools/:tool_id/validate` | 🔜 | Server-side input validation |
| POST | `/client_tools/:tool_id/calculate` | 🔜 | Optional server verification |

## Exports

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/exports` | 🔜 | Create export job (PDF / Excel / PNG) |
| GET | `/exports/:id` | 🔜 | Poll export status / download |

## Topic integration

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/topic_drafts` | 🔜 | Create Discourse topic draft from calculation |

## Design projects

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/projects` | 🔜 | List design projects |
| POST | `/projects` | 🔜 | Create project |
| GET | `/projects/:id` | 🔜 | Project detail |
| PUT | `/projects/:id` | 🔜 | Update project |
| DELETE | `/projects/:id` | 🔜 | Delete project |

## Admin

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/admin/stats` | ✅ | Aggregate counts (admin only) |

## Extending the API

1. Add route in `config/routes.rb`
2. Register capability in `lib/discourse_mechbox/api_capabilities.rb`
3. Add controller action (implement or stub with feature gate)
4. Add `require_relative` in `plugin.rb`
5. Add locale strings under `mechbox.errors.*`
6. Document here and in `docs/REQUIREMENTS.md`
