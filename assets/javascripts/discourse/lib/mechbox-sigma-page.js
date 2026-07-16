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

function t(key, options) {
  return i18n(`mechbox.sigma_analysis.${key}`, options);
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
  row.className = "mechbox-sigma__field";
  const label = document.createElement("label");
  label.className = "mechbox-sigma__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-sigma__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-sigma__unit";
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
  input.className = "mechbox__inputs mechbox-sigma__input";
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

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-sigma__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "C=T/(6\\sigma)",
        "C_{pk}=\\min\\!\\left(\\frac{USL-\\mu}{3\\sigma},\\frac{\\mu-LSL}{3\\sigma}\\right)",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\sigma_{\\mathrm{level}}=3\\,C_{pk}",
        "Y=\\Phi\\!\\left(\\frac{USL-\\mu}{\\sigma}\\right)-\\Phi\\!\\left(\\frac{LSL-\\mu}{\\sigma}\\right)",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "\\sigma_{\\mathrm{LT}}=\\max(0,\\,3C_{pk}-1.5)",
        "\\hat{\\mu},\\hat{\\sigma}\\ \\text{from sample}",
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
  row.className = "mechbox-sigma__result-row";
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
    lsl: Number(root.querySelector('input[name="lsl"]')?.value),
    usl: Number(root.querySelector('input[name="usl"]')?.value),
    mean: Number(root.querySelector('input[name="mean"]')?.value),
    sigma: Number(root.querySelector('input[name="sigma"]')?.value),
  };

  if (calcMode === "full" || calcMode === "professional") {
    inputs.min_cpk = Number(root.querySelector('input[name="min_cpk"]')?.value);
  }

  if (calcMode === "professional") {
    inputs.sample_values = root.querySelector('textarea[name="sample_values"]')?.value || "";
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-sigma__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-sigma__status ${
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
  list.className = "mechbox-sigma__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_c")} ` }, { tex: "C" }],
      [{ text: formatNumber(outputs.c, 2) }]
    ),
    resultRow(
      [{ text: `${t("result_cpk")} ` }, { tex: "C_{pk}" }],
      [{ text: formatNumber(outputs.cpk, 2) }],
      { danger: outputs.cpk_pass === false }
    ),
    resultRow(
      [{ text: t("result_sigma_level") }],
      [{ tex: `${formatNumber(outputs.sigma_level, 2)}\\sigma` }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: `${t("result_cpu")} ` }, { tex: "C_{pu}" }],
        [{ text: formatNumber(outputs.cpu, 2) }]
      ),
      resultRow(
        [{ text: `${t("result_cpl")} ` }, { tex: "C_{pl}" }],
        [{ text: formatNumber(outputs.cpl, 2) }]
      ),
      resultRow(
        [{ text: t("result_pass_rate") }],
        [
          {
            tex: `${formatNumber(Number(outputs.pass_rate) * 100, 2)}\\%`,
          },
        ],
        { danger: outputs.pass_rate_pass === false }
      ),
      resultRow(
        [{ text: t("result_dppm") }],
        [{ text: String(outputs.dppm ?? "—") }]
      )
    );
  }

  if (calcMode === "professional") {
    if (outputs.long_term_sigma_level != null) {
      list.append(
        resultRow(
          [{ text: t("result_long_term") }],
          [{ tex: `${formatNumber(outputs.long_term_sigma_level, 2)}\\sigma` }]
        )
      );
    }
    if (outputs.sample_count) {
      list.append(
        resultRow(
          [{ text: t("result_sample_count") }],
          [{ text: String(outputs.sample_count) }]
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setSigmaError(panel, message) {
  const error = panel.querySelector(".mechbox-sigma__error");
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

async function calculateSigma(panel, button) {
  const root = panel.querySelector(".mechbox-sigma");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setSigmaError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "sigma_analysis",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setSigmaError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountSigmaAnalysisWorkbench(panel) {
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
    "mechbox__workbench-panel--chain",
    "mechbox__workbench-panel--tol-convert",
    "mechbox__workbench-panel--sigma",
    "mechbox__workbench-panel--fit"
  );
  panel.classList.add("mechbox__workbench-panel--sigma");

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
  root.className = "mechbox-sigma";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-sigma__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-sigma__mode-tab";
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
  formulaBar.className = "mechbox-sigma__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-sigma__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-sigma__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const minCpkRow = fieldRow(
    mixedLabel([{ text: t("min_cpk") }, { text: " " }, { tex: "C_{pk,\\min}" }]),
    numberInput("min_cpk", "1.33"),
    document.createTextNode("—")
  );
  minCpkRow.dataset.calcShow = "full professional";

  const sampleRow = document.createElement("div");
  sampleRow.className = "mechbox-sigma__field";
  sampleRow.dataset.calcShow = "professional";
  const sampleLabel = document.createElement("label");
  sampleLabel.className = "mechbox-sigma__label";
  sampleLabel.textContent = t("sample_values");
  const sampleControl = document.createElement("div");
  sampleControl.className = "mechbox-sigma__control";
  const sampleArea = document.createElement("textarea");
  sampleArea.className = "mechbox__inputs mechbox-sigma__textarea";
  sampleArea.name = "sample_values";
  sampleArea.rows = 3;
  sampleArea.placeholder = t("sample_placeholder");
  sampleArea.value = "";
  sampleControl.append(sampleArea);
  sampleRow.append(sampleLabel, sampleControl, document.createElement("span"));

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("lsl") }, { text: " " }, { tex: "LSL" }]),
      numberInput("lsl", "9.875"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("usl") }, { text: " " }, { tex: "USL" }]),
      numberInput("usl", "10.125"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("mean") }, { text: " " }, { tex: "\\mu" }]),
      numberInput("mean", "10"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("sigma") }, { text: " " }, { tex: "\\sigma" }]),
      numberInput("sigma", "0.042"),
      document.createTextNode("—")
    ),
    minCpkRow,
    sampleRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-sigma__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateSigma(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-sigma__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-sigma__card mechbox-sigma__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-sigma__results-body";
  resultsBody.innerHTML = `<p class="mechbox-sigma__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}
