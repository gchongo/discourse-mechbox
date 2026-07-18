import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import { ensureKatex, fillFormulaBar, typesetRoot } from "./mechbox-tex";

const CALC_MODES = ["simple", "full", "professional"];

const DEFAULT_SYSTEMS = [
  "metric",
  "unc",
  "unf",
  "unef",
  "tr",
  "acme",
  "npt",
  "nptf",
  "g",
  "r",
];

const WORKBENCH_PANEL_CLASSES = [
  "mechbox__workbench-panel--bolt",
  "mechbox__workbench-panel--units",
  "mechbox__workbench-panel--rss",
  "mechbox__workbench-panel--gdt",
  "mechbox__workbench-panel--thread",
  "mechbox__workbench-panel--key",
  "mechbox__workbench-panel--bolt-group",
  "mechbox__workbench-panel--weld",
  "mechbox__workbench-panel--spring",
  "mechbox__workbench-panel--clutch",
  "mechbox__workbench-panel--belt",
  "mechbox__workbench-panel--chain",
  "mechbox__workbench-panel--tol-convert",
  "mechbox__workbench-panel--sigma",
  "mechbox__workbench-panel--fit",
  "mechbox__workbench-panel--distribution",
  "mechbox__workbench-panel--thermal",
  "mechbox__workbench-panel--interference",
  "mechbox__workbench-panel--bearing",
  "mechbox__workbench-panel--shaft",
  "mechbox__workbench-panel--gear-ratio",
  "mechbox__workbench-panel--gear",
  "mechbox__workbench-panel--fatigue",
  "mechbox__workbench-panel--beam",
  "mechbox__workbench-panel--sheet-metal",
  "mechbox__workbench-panel--cylinder",
  "mechbox__workbench-panel--o-ring",
  "mechbox__workbench-panel--structural",
  "mechbox__workbench-panel--manufacturing",
  "mechbox__workbench-panel--heat-treatment",
  "mechbox__workbench-panel--materials",
  "mechbox__workbench-panel--material-selection",
  "mechbox__workbench-panel--thread-table",
];

function t(key, options) {
  return i18n(`mechbox.thread_table.${key}`, options);
}

function formatNumber(value, digits = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function systemLabel(id) {
  const label = t(`system_${id}`);
  return label.startsWith("mechbox.thread_table.") ? id.toUpperCase() : label;
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-thread-table__field";
  const label = document.createElement("label");
  label.className = "mechbox-thread-table__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-thread-table__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-thread-table__unit";
  if (unitEl) {
    unit.append(unitEl);
  }
  row.append(label, controlWrap, unit);
  return row;
}

function textInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "mechbox__inputs mechbox-thread-table__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  return input;
}

function numberInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "mechbox__inputs mechbox-thread-table__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-thread-table__select";
  select.name = name;
  options.forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (val === value) {
      opt.selected = true;
    }
    select.append(opt);
  });
  return select;
}

function defaultSystemOptions() {
  return [["", t("system_all")], ...DEFAULT_SYSTEMS.map((id) => [id, systemLabel(id)])];
}

function getCalcMode(root) {
  return root.dataset.calcMode || "simple";
}

function setCalcMode(root, mode) {
  root.dataset.calcMode = mode;
}

function syncModeTabs(root) {
  const calcMode = getCalcMode(root);
  root.querySelectorAll("[data-calc-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.calcMode === calcMode);
  });
}

function modeTabLabel(mode) {
  if (mode === "simple") {
    return t("mode_simple");
  }
  if (mode === "full") {
    return t("mode_full");
  }
  return t("mode_professional");
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-thread-table__formula-bar");
  if (!bar) {
    return;
  }

  fillFormulaBar(bar, {
    title: t("formula_title"),
    hint: t("formula_hint"),
  });
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function normalizeSystemId(system) {
  if (typeof system === "string") {
    return system;
  }
  return system?.id || "";
}

function updateSystemOptions(root, systems, selected) {
  const select = root.querySelector('select[name="system"]');
  if (!select) {
    return;
  }

  const current = selected ?? select.value;
  select.replaceChildren();

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = t("system_all");
  select.append(empty);

  const ids = (systems || []).map(normalizeSystemId).filter(Boolean);
  const uniqueIds = ids.length ? [...new Set(ids)] : DEFAULT_SYSTEMS;

  uniqueIds.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = systemLabel(id);
    if (id === current) {
      opt.selected = true;
    }
    select.append(opt);
  });

  if (current && !uniqueIds.includes(current)) {
    select.value = current;
  }
}

function optionalInputValue(root, name) {
  return root.querySelector(`input[name="${name}"]`)?.value?.trim() || "";
}

function collectInputs(root) {
  return {
    calc_mode: getCalcMode(root),
    query: root.querySelector('input[name="query"]')?.value || "",
    system: root.querySelector('select[name="system"]')?.value || "",
    diameter_min: optionalInputValue(root, "diameter_min"),
    diameter_max: optionalInputValue(root, "diameter_max"),
  };
}

function formatPitchOrTpi(row) {
  if (row.tpi != null && row.tpi !== "") {
    return `${formatNumber(row.tpi, 0)} TPI`;
  }
  if (row.pitch != null && row.pitch !== "") {
    return formatNumber(row.pitch, 3);
  }
  return "—";
}

function formatPitchDia(row) {
  const value = row.pitchDia ?? row.pitchDiameter;
  if (value == null || value === "") {
    return "—";
  }
  return formatNumber(value, 3);
}

function renderResultsTable(rows) {
  const table = document.createElement("table");
  table.className = "mechbox-thread-table__table";
  table.innerHTML = `<thead><tr>
    <th>${t("col_designation")}</th>
    <th>${t("col_system")}</th>
    <th>${t("col_sub_series")}</th>
    <th>${t("col_pitch")}</th>
    <th>${t("col_major")}</th>
    <th>${t("col_pitch_dia")}</th>
    <th>${t("col_minor")}</th>
    <th>${t("col_tap_drill")}</th>
    <th>${t("col_tolerance_external")}</th>
    <th>${t("col_tolerance_internal")}</th>
  </tr></thead>`;

  const tbody = document.createElement("tbody");
  (rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.designation ?? "—"}</td>
      <td>${row.system ?? "—"}</td>
      <td>${row.subSeries ?? "—"}</td>
      <td>${formatPitchOrTpi(row)}</td>
      <td>${formatNumber(row.major, 3)}</td>
      <td>${formatPitchDia(row)}</td>
      <td>${formatNumber(row.minor, 3)}</td>
      <td>${formatNumber(row.tapDrill, 3)}</td>
      <td>${row.toleranceExternal ?? "—"}</td>
      <td>${row.toleranceInternal ?? "—"}</td>`;
    tbody.append(tr);
  });

  table.append(tbody);
  return table;
}

async function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-thread-table");
  const box = panel.querySelector(".mechbox-thread-table__results-body");
  if (!box || !root) {
    return;
  }

  const outputs = payload?.outputs || {};
  const rows = outputs.rows || [];

  if (outputs.systems?.length) {
    updateSystemOptions(root, outputs.systems, outputs.system || "");
  }

  box.replaceChildren();
  box.classList.add("is-visible");

  const summary = document.createElement("p");
  summary.className = "mechbox-thread-table__summary";
  summary.textContent = t("result_count", {
    count: outputs.count ?? rows.length,
    matched: outputs.matched_count ?? outputs.count ?? rows.length,
    total: outputs.total_count ?? rows.length,
  });
  box.append(summary);

  if (outputs.truncated) {
    const truncated = document.createElement("p");
    truncated.className = "mechbox-thread-table__truncated";
    truncated.textContent = t("result_truncated");
    box.append(truncated);
  }

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "mechbox-thread-table__empty";
    empty.textContent = t("results_none");
    box.append(empty);
    return;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "mechbox-thread-table__table-wrap";
  tableWrap.append(renderResultsTable(rows));
  box.append(tableWrap);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-thread-table__error");
  if (!error) {
    return;
  }
  if (message) {
    error.hidden = false;
    error.textContent = message;
  } else {
    error.hidden = true;
    error.textContent = "";
  }
}

async function calculateThreadTable(panel, button) {
  const root = panel.querySelector(".mechbox-thread-table");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "thread_table",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountThreadTableWorkbench(panel) {
  await ensureKatex();

  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--thread-table");

  ["mechbox__actions", "mechbox__error", "mechbox__result-title", "mechbox__result"].forEach(
    (cls) => {
      const el = panel.querySelector(`.${cls}`);
      if (el) {
        el.hidden = true;
      }
    }
  );

  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-thread-table";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-thread-table__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-thread-table__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-thread-table__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-thread-table__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-thread-table__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const systemSelect = selectInput("system", defaultSystemOptions(), "");
  inputsCard.append(
    fieldRow(document.createTextNode(t("system")), systemSelect, document.createTextNode(""))
  );

  const queryInput = textInput("query", "");
  queryInput.placeholder = t("query_placeholder");
  inputsCard.append(
    fieldRow(document.createTextNode(t("query")), queryInput, document.createTextNode(""))
  );

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("diameter_min")),
      numberInput("diameter_min", ""),
      document.createTextNode("")
    )
  );

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("diameter_max")),
      numberInput("diameter_max", ""),
      document.createTextNode("")
    )
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-thread-table__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateThreadTable(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-thread-table__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-thread-table__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-thread-table__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncModeTabs(root);
  updateFormulaBar(root);
  await calculateThreadTable(panel, calcBtn);
}
