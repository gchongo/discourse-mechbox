# Discourse MechBox v0.1 (MVP) release checklist

## Scope

- Native `/mechbox` page in Discourse with tool list, JSON input workbench, result panel, records, and favorites.
- Stable MVP API contract:
  - `GET /metadata`
  - `GET /tools`
  - `POST /calculate`
  - `GET /records`
  - `GET/POST/DELETE /favorites`
- Capability-gated non-MVP endpoints continue returning `501`.

## Verification

1. Enable `mechbox_enabled` in admin settings.
2. Visit `/mechbox` as a permitted user.
3. Run one builtin calculation (`gear_ratio` recommended).
4. Confirm record appears in recent records list.
5. Toggle one favorite tool and verify persistence after refresh.
6. Verify disabled endpoints still return `501` with a clear error message.

## Automated tests

```bash
bin/rspec plugins/discourse-mechbox/spec/requests/discourse_mechbox
pnpm qunit-test plugins/discourse-mechbox/test/javascripts/acceptance/mechbox-test.js
```

## Follow-up after v0.1

- Expand builtin tools coverage.
- Add template management UI.
- Add export and project endpoints behind capability flags.
