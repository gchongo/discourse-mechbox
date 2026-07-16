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
const DISTRIBUTIONS = [
  "normal",
  "uniform",
  "rectangular",
  "triangular",
  "skewed",
];

function t(key, options) {
  return i18n(`mechbox.tol_convert.${key}`, options);
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-tol-convert__field";
  const label = document.createElement("label");
  label.className = "mechbox-tol-convert__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-tol-convert__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-tol-convert__unit";
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
  input.className = "mechbox__inputs mechbox-tol-convert__input";
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

function getDirection(root) {
  return root.dataset.direction || "t2s";
}

function setDirection(root, direction) {
  root.dataset.direction = direction;
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

function syncDirectionTabs(root) {
  const direction = getDirection(root);
  root.querySelectorAll("[data-direction]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.direction === direction);
  });
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-tol-convert__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  const direction = getDirection(root);

  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas:
        direction === "t2s"
          ? ["\\sigma = T / K,\\quad K=6\\ (\\text{normal})"]
          : ["T = K \\sigma,\\quad K=6\\ (\\text{normal})"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        direction === "t2s" ? "\\sigma = T / K" : "T = K \\sigma",
        "K_{\\mathrm{n}}=6,\\ K_{\\mathrm{u}}=3.46,\\ K_{\\triangle}=4.24",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        direction === "t2s" ? "\\sigma = T / K_{\\mathrm{custom}}" : "T = K_{\\mathrm{custom}} \\sigma",
      ],
    });
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
  syncVisibility(root);
  updateFormulaBar(root);
}

function applyDirection(root, direction) {
  setDirection(root, direction);
  syncDirectionTabs(root);
  updateFormulaBar(root);
  syncValueLabel(root);
}

function syncValueLabel(root) {
  const label = root.querySelector("[data-value-label]");
  if (!label) {
    return;
  }
  label.replaceChildren();
  const direction = getDirection(root);
  label.append(
    mixedLabel([
      { text: direction === "t2s" ? t("input_tolerance") : t("input_sigma") },
      { text: " " },
      { tex: direction === "t2s" ? "T" : "\\sigma" },
    ])
  );
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

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-tol-convert__result-row";
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

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    direction: getDirection(root),
    value: Number(root.querySelector('input[name="value"]')?.value),
  };

  if (calcMode === "simple") {
    inputs.distribution = "normal";
  } else {
    inputs.distribution =
      root.querySelector('select[name="distribution"]')?.value || "normal";
  }

  if (calcMode === "professional") {
    inputs.k_factor = Number(root.querySelector('input[name="k_factor"]')?.value);
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-tol-convert__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  const direction = outputs.direction || "t2s";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-tol-convert__status ${
    outputs.estimate_only
      ? "is-attention"
      : outputs.pass
        ? "is-pass"
        : "is-attention"
  }`;
  status.textContent = `${t("overall")}: ${
    outputs.estimate_only
      ? t("status_estimate")
      : outputs.pass
        ? t("status_pass")
        : t("status_attention")
  }`;
  box.append(status);

  const list = document.createElement("dl");
  list.className = "mechbox-tol-convert__result-list";

  if (direction === "t2s") {
    list.append(
      resultRow(
        [{ text: `${t("result_sigma")} ` }, { tex: "\\sigma" }],
        [{ tex: formatNumber(outputs.output_sigma, 4) }]
      ),
      resultRow(
        [{ text: `${t("result_tolerance")} ` }, { tex: "T" }],
        [{ tex: formatNumber(outputs.input_tolerance ?? outputs.value, 4) }]
      )
    );
  } else {
    list.append(
      resultRow(
        [{ text: `${t("result_tolerance")} ` }, { tex: "T" }],
        [{ tex: formatNumber(outputs.output_tolerance, 4) }]
      ),
      resultRow(
        [{ text: `${t("result_sigma")} ` }, { tex: "\\sigma" }],
        [{ tex: formatNumber(outputs.input_sigma ?? outputs.value, 4) }]
      )
    );
  }

  list.append(
    resultRow(
      [{ text: `${t("result_k")} ` }, { tex: "K" }],
      [{ text: formatNumber(outputs.k_factor, 2) }]
    ),
    resultRow(
      [{ text: t("result_distribution") }],
      [{ text: t(`dist_${outputs.distribution || "normal"}`) }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_cv") }],
        [{ text: formatNumber(outputs.cv, 3) }]
      ),
      resultRow(
        [{ text: t("result_coverage") }],
        [
          {
            tex: `${formatNumber(Number(outputs.coverage) * 100, 2)}\\%`,
          },
        ]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setTolError(panel, message) {
  const error = panel.querySelector(".mechbox-tol-convert__error");
  if (!error) {
    return;
  }
  if (message) {
    error.textContent = message;
    error.hidden = false;
  } else {
    error.textContent = "";
    error.hidden = true;
  }
}

async function calculateTolConvert(panel, button) {
  const root = panel.querySelector(".mechbox-tol-convert");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setTolError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "tol_convert",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setTolError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountTolConvertWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  await ensureKatex();

  panel.classList.remove(
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
    "mechbox__workbench-panel--chain"
  );
  panel.classList.add("mechbox__workbench-panel--tol-convert");

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
  root.className = "mechbox-tol-convert";
  setCalcMode(root, "simple");
  setDirection(root, "t2s");

  const modes = document.createElement("div");
  modes.className = "mechbox-tol-convert__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-tol-convert__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyCalcMode(root, mode);
      typesetRoot(root);
    });
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-tol-convert__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-tol-convert__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-tol-convert__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const directionRow = document.createElement("div");
  directionRow.className = "mechbox-tol-convert__field";
  const directionLabel = document.createElement("label");
  directionLabel.className = "mechbox-tol-convert__label";
  directionLabel.textContent = t("direction");
  const directionControl = document.createElement("div");
  directionControl.className = "mechbox-tol-convert__control mechbox-tol-convert__modes";
  ["t2s", "s2t"].forEach((dir) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-tol-convert__mode-tab";
    btn.dataset.direction = dir;
    btn.textContent = dir === "t2s" ? t("direction_t2s") : t("direction_s2t");
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyDirection(root, dir);
      typesetRoot(root);
    });
    directionControl.append(btn);
  });
  directionRow.append(directionLabel, directionControl, document.createElement("span"));

  const distSelect = document.createElement("select");
  distSelect.className = "mechbox__inputs mechbox-tol-convert__input";
  distSelect.name = "distribution";
  DISTRIBUTIONS.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = t(`dist_${key}`);
    if (key === "normal") {
      option.selected = true;
    }
    distSelect.append(option);
  });
  const distRow = fieldRow(document.createTextNode(t("distribution")), distSelect, document.createTextNode("—"));
  distRow.dataset.calcShow = "full professional";

  const valueLabel = document.createElement("span");
  valueLabel.dataset.valueLabel = "true";

  const kRow = fieldRow(
    mixedLabel([{ text: t("k_factor") }, { text: " " }, { tex: "K" }]),
    numberInput("k_factor", "6"),
    document.createTextNode("—")
  );
  kRow.dataset.calcShow = "professional";

  inputsCard.append(
    directionRow,
    distRow,
    fieldRow(valueLabel, numberInput("value", "0.25"), document.createTextNode("—")),
    kRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-tol-convert__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateTolConvert(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-tol-convert__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-tol-convert__card mechbox-tol-convert__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-tol-convert__results-body";
  resultsBody.innerHTML = `<p class="mechbox-tol-convert__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
  applyDirection(root, "t2s");
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}
