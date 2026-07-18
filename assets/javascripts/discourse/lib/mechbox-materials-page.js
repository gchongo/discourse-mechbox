import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import { ensureKatex, typesetRoot } from "./mechbox-tex";

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
  return i18n(`mechbox.materials.${key}`, options);
}

function formatNumber(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-materials__field";
  const label = document.createElement("label");
  label.className = "mechbox-materials__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-materials__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-materials__unit";
  if (unitEl) {
    unit.append(unitEl);
  }
  row.append(label, controlWrap, unit);
  return row;
}

function textInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "mechbox__inputs mechbox-materials__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  return input;
}

function numberInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "mechbox__inputs mechbox-materials__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-materials__select";
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

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
}

function updateCategoryOptions(root, categories, selected) {
  const select = root.querySelector('select[name="category"]');
  if (!select) {
    return;
  }

  const current = selected ?? select.value;
  select.replaceChildren();

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = t("category_all");
  select.append(empty);

  (categories || []).forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === current) {
      opt.selected = true;
    }
    select.append(opt);
  });
}

function collectInputs(root) {
  return {
    calc_mode: getCalcMode(root),
    query: root.querySelector('input[name="query"]')?.value || "",
    category: root.querySelector('select[name="category"]')?.value || "",
    temp_c: Number(root.querySelector('input[name="temp_c"]')?.value || 20),
  };
}

function renderMaterialCard(material) {
  const card = document.createElement("div");
  card.className = "mechbox-materials__result-card";

  const title = document.createElement("h4");
  title.className = "mechbox-materials__result-name";
  title.textContent = material.name || "—";
  card.append(title);

  const meta = document.createElement("p");
  meta.className = "mechbox-materials__result-category";
  meta.textContent = material.category || "—";
  card.append(meta);

  const list = document.createElement("dl");
  list.className = "mechbox-materials__result-list";

  [
    [t("result_sigma"), `${formatNumber(material.sigma_allow_at_temp_mpa)} MPa`],
    [t("result_tau"), `${formatNumber(material.tau_allow_at_temp_mpa)} MPa`],
    [t("result_e"), `${formatNumber(material.E, 0)} MPa`],
    [t("result_density"), `${formatNumber(material.density, 2)} g/cm³`],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "mechbox-materials__result-row";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.append(dt, dd);
    list.append(row);
  });

  card.append(list);
  return card;
}

async function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-materials");
  const box = panel.querySelector(".mechbox-materials__results-body");
  if (!box || !root) {
    return;
  }

  const outputs = payload?.outputs || {};
  const materials = outputs.materials || [];

  if (outputs.categories?.length) {
    updateCategoryOptions(root, outputs.categories, outputs.category || "");
  }

  box.replaceChildren();
  box.classList.add("is-visible");

  const summary = document.createElement("p");
  summary.className = "mechbox-materials__summary";
  summary.textContent = t("result_count", {
    count: outputs.count ?? materials.length,
    total: outputs.total_count ?? materials.length,
  });
  box.append(summary);

  if (!materials.length) {
    const empty = document.createElement("p");
    empty.className = "mechbox-materials__empty";
    empty.textContent = t("results_none");
    box.append(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "mechbox-materials__result-grid";
  materials.forEach((material) => grid.append(renderMaterialCard(material)));
  box.append(grid);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-materials__error");
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

async function calculateMaterials(panel, button) {
  const root = panel.querySelector(".mechbox-materials");
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
        tool_id: "materials",
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

export async function mountMaterialsWorkbench(panel) {
  await ensureKatex();

  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--materials");

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
  root.className = "mechbox-materials";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-materials__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-materials__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const grid = document.createElement("div");
  grid.className = "mechbox-materials__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-materials__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const queryInput = textInput("query", "");
  queryInput.placeholder = t("query_placeholder");
  inputsCard.append(
    fieldRow(document.createTextNode(t("query")), queryInput, document.createTextNode(""))
  );

  const categorySelect = selectInput("category", [["", t("category_all")]], "");
  inputsCard.append(
    fieldRow(document.createTextNode(t("category")), categorySelect, document.createTextNode(""))
  );

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("temp_c")),
      numberInput("temp_c", "20"),
      document.createTextNode("°C")
    )
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-materials__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateMaterials(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-materials__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-materials__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-materials__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, grid);
  mount.append(root);

  syncModeTabs(root);
  await calculateMaterials(panel, calcBtn);
}
