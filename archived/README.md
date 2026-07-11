# Archived MechBox code

Business logic lives here while the plugin runs in **safe skeleton** mode.

**Nothing in this directory is autoloaded by Rails** (Zeitwerk only scans `app/` and `lib/`). Copying files back without a staged plan caused production 502 — see [docs/BOOT_FAILURES.md](../docs/BOOT_FAILURES.md).

Restore one module at a time per [docs/PHASED_ROADMAP.md](../docs/PHASED_ROADMAP.md); rebuild and verify the forum after each step.
