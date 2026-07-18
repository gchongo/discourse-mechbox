import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  fillFormulaBar,
  mixedLabel,
  typesetRoot,
} from "./mechbox-tex";

const CALC_MODES = ["simple", "full", "professional"];

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
];

function t(key, options) {
  return i18n(`mechbox.material_selection.${key}`, options);
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-material-selection__field";
  const label = document.createElement("label");
  label.className = "mechbox-material-selection__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-material-selection__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-material-selection__unit";
  if (unitEl) {
    unit.append(unitEl);
  }
  row.append(label, controlWrap, unit);
  return row;
}

function numberInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "mechbox__inputs mechbox-material-selection__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function getCalcMode(root) {
  return root.dataset.calcMode || "simple";
}

function setCalcMode(root, mode) {
  root.dataset.calcMode = mode;
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });
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
  const bar = root.querySelector(".mechbox-material-selection__formula-bar");
  if (!bar) {
    return;
  }

  fillFormulaBar(bar, {
    title: t("formula_title"),
    hint: t("formula_hint"),
    formulas: ["S=\\sum w_i s_i"],
  });
  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  return {
    calc_mode: calcMode,
    min_sigma_allow_mpa: Number(
      root.querySelector('input[name="min_sigma_allow_mpa"]')?.value || 150
    ),
    max_density: Number(root.querySelector('input[name="max_density"]')?.value || 8),
    temp_c: Number(root.querySelector('input[name="temp_c"]')?.value || 20),
    min_weldability: Number(root.querySelector('input[name="min_weldability"]')?.value || 2),
    max_cost_index: Number(root.querySelector('input[name="max_cost_index"]')?.value || 3),
    weight_strength: Number(root.querySelector('input[name="weight_strength"]')?.value || 0.35),
    weight_light: Number(root.querySelector('input[name="weight_light"]')?.value || 0.2),
    weight_cost: Number(root.querySelector('input[name="weight_cost"]')?.value || 0.2),
    weight_weldability: Number(
      root.querySelector('input[name="weight_weldability"]')?.value || 0.15
    ),
    weight_machinability: Number(
      root.querySelector('input[name="weight_machinability"]')?.value || 0.1
    ),
  };
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-material-selection__result-row";
  if (options.danger) {
    row.classList.add("is-danger");
  }
  const dt = document.createElement("dt");
  dt.append(mixedLabel(labelParts));
  const dd = document.createElement("dd");
  dd.append(mixedLabel(valueParts));
  row.append(dt, dd);
  return row;
}

function renderRecommendationsTable(recommendations, showBreakdown) {
  const table = document.createElement("table");
  table.className = "mechbox-material-selection__table";
  table.innerHTML = `<thead><tr>
    <th>${t("col_rank")}</th>
    <th>${t("col_name")}</th>
    <th>${t("col_score")}</th>
    <th>[σ]</th>
    <th>ρ</th>
    <th>${t("col_cost")}</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");

  (recommendations || []).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.rank ?? "—"}</td>
      <td>${row.name ?? "—"}</td>
      <td>${formatNumber(row.total_score, 1)}</td>
      <td>${formatNumber(row.sigma_allow_mpa, 0)}</td>
      <td>${formatNumber(row.density, 2)}</td>
      <td>${formatNumber(row.cost_index, 1)}</td>`;
    tbody.append(tr);

    if (showBreakdown && row.scores) {
      const detail = document.createElement("tr");
      detail.className = "mechbox-material-selection__score-detail";
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = t("score_breakdown", {
        strength: formatNumber(row.scores.strength, 3),
        weight: formatNumber(row.scores.weight, 3),
        cost: formatNumber(row.scores.cost, 3),
        weldability: formatNumber(row.scores.weldability, 3),
        machinability: formatNumber(row.scores.machinability, 3),
      });
      detail.append(td);
      tbody.append(detail);
    }
  });

  table.append(tbody);
  return table;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-material-selection__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  const topPick = outputs.top_pick;
  const recommendations = outputs.recommendations || [];

  box.replaceChildren();
  box.classList.add("is-visible");

  if (topPick) {
    const pick = document.createElement("div");
    pick.className = "mechbox-material-selection__top-pick";
    const pickLabel = document.createElement("p");
    pickLabel.className = "mechbox-material-selection__top-label";
    pickLabel.textContent = t("top_pick");
    const pickName = document.createElement("p");
    pickName.className = "mechbox-material-selection__top-name";
    pickName.textContent = topPick.name || "—";
    const pickScore = document.createElement("p");
    pickScore.className = "mechbox-material-selection__top-score";
    pickScore.textContent = t("top_score", {
      score: formatNumber(topPick.total_score, 1),
    });
    pick.append(pickLabel, pickName, pickScore);
    box.append(pick);
  }

  const counts = document.createElement("p");
  counts.className = "mechbox-material-selection__counts";
  counts.textContent = t("filtered_count", {
    filtered: outputs.filtered_count ?? 0,
    total: outputs.total_count ?? 0,
  });
  box.append(counts);

  if (calcMode === "professional") {
    const bests = document.createElement("div");
    bests.className = "mechbox-material-selection__bests";
    bests.textContent = t("best_picks", {
      strength: outputs.best_strength?.name || "—",
      weight: outputs.best_weight?.name || "—",
      cost: outputs.best_cost?.name || "—",
    });
    box.append(bests);
  }

  if (recommendations.length) {
    box.append(renderRecommendationsTable(recommendations, outputs.show_score_breakdown));
  } else {
    const empty = document.createElement("p");
    empty.className = "mechbox-material-selection__empty";
    empty.textContent = t("results_none");
    box.append(empty);
  }

  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-material-selection__error");
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

async function calculateMaterialSelection(panel, button) {
  const root = panel.querySelector(".mechbox-material-selection");
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
        tool_id: "material_selection",
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

export async function mountMaterialSelectionWorkbench(panel) {
  await ensureKatex();

  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--material-selection");

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
  root.className = "mechbox-material-selection";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-material-selection__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-material-selection__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-material-selection__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-material-selection__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-material-selection__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  [
    ["min_sigma_allow_mpa", "min_sigma_allow", "150", "MPa"],
    ["max_density", "max_density", "8", "g/cm³"],
    ["temp_c", "temp_c", "20", "°C"],
    ["min_weldability", "min_weldability", "2", "1–5"],
    ["max_cost_index", "max_cost_index", "3", "-"],
  ].forEach(([name, labelKey, value, unit]) => {
    inputsCard.append(
      fieldRow(
        document.createTextNode(t(labelKey)),
        numberInput(name, value),
        document.createTextNode(unit)
      )
    );
  });

  const weightsTitle = document.createElement("h4");
  weightsTitle.className = "mechbox-material-selection__weights-title";
  weightsTitle.textContent = t("weights_title");
  inputsCard.append(weightsTitle);

  [
    ["weight_strength", "weight_strength", "0.35"],
    ["weight_light", "weight_light", "0.2"],
    ["weight_cost", "weight_cost", "0.2"],
    ["weight_weldability", "weight_weldability", "0.15"],
    ["weight_machinability", "weight_machinability", "0.1"],
  ].forEach(([name, labelKey, value]) => {
    inputsCard.append(
      fieldRow(
        document.createTextNode(t(labelKey)),
        numberInput(name, value),
        document.createTextNode("-")
      )
    );
  });

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-material-selection__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateMaterialSelection(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-material-selection__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-material-selection__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-material-selection__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
