/**
 * One-shot export: MechBox thread catalog -> discourse-mechbox JSON.
 * Regenerate: node plugins/discourse-mechbox/scripts/export_thread_standards.mjs
 */
import { register } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(SCRIPT_DIR);
const OUT_PATH = join(
  PLUGIN_ROOT,
  "lib",
  "discourse_mechbox",
  "data",
  "thread_standards.json",
);

const MECHBOX_ROOT = process.env.MECHBOX_ROOT || "D:/MechBox";
const MECHBOX_INDEX = pathToFileURL(
  join(MECHBOX_ROOT, "src/constants/thread-standards/index.js").replace(/\\/g, "/"),
).href;

register("./esm-extensionless-hook.mjs", import.meta.url);

const KNOWN_FIELDS = [
  "id",
  "system",
  "subSeries",
  "designation",
  "priority",
  "standardRef",
  "unit",
  "nominal",
  "pitch",
  "tpi",
  "major",
  "pitchDia",
  "pitchDiameter",
  "minor",
  "tapDrill",
  "toleranceExternal",
  "toleranceInternal",
  "sealing",
  "taper",
  "usageKey",
  "threadAngle",
  "compatibility",
];

function serializeRow(row) {
  const out = {};
  for (const key of KNOWN_FIELDS) {
    if (row[key] !== undefined && row[key] !== null) {
      out[key] = row[key];
    }
  }
  if (out.pitchDia === undefined && out.pitchDiameter !== undefined) {
    out.pitchDia = out.pitchDiameter;
  }
  for (const [key, value] of Object.entries(row)) {
    if (out[key] !== undefined) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

function buildSystemsMeta(threadSystems) {
  return threadSystems.map(({ id, standardRef, unit, angle, subTabs }) => ({
    id,
    standardRef,
    unit,
    ...(angle !== undefined ? { angle } : {}),
    subTabs: (subTabs ?? []).map((t) => t.id),
  }));
}

const { getAllThreadRows, THREAD_SYSTEMS } = await import(MECHBOX_INDEX);
const rows = getAllThreadRows().map(serializeRow);
const payload = {
  systems: buildSystemsMeta(THREAD_SYSTEMS),
  rows,
  total_count: rows.length,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${OUT_PATH}`);
console.log(`total_count=${payload.total_count}`);
console.log(`systems=${payload.systems.map((s) => s.id).join(",")}`);

