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
  return i18n(`mechbox.distribution_chart.${key}`, options);
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
  row.className = "mechbox-distribution__field";
  const label = document.createElement("label");
  label.className = "mechbox-distribution__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-distribution__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-distribution__unit";
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
  input.className = "mechbox__inputs mechbox-distribution__input";
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
  const bar = root.querySelector(".mechbox-distribution__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "\\sigma=T/K",
        "f(x)=\\frac{1}{\\sigma\\sqrt{2\\pi}}e^{-\\frac12((x-\\mu)/\\sigma)^2}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "K,\\,\\mathrm{cv},\\,\\mathrm{coverage}\\ \\text{by distribution}",
        "\\text{PDF samples on }[-T,T]",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "\\sigma=T/K\\ \\text{or override}",
        "Y=\\Phi\\!\\left(\\frac{USL-\\mu}{\\sigma}\\right)-\\Phi\\!\\left(\\frac{LSL-\\mu}{\\sigma}\\right)",
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
  row.className = "mechbox-distribution__result-row";
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

function distLabel(key) {
  return t(`dist_${key}`);
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    tolerance: Number(root.querySelector('input[name="tolerance"]')?.value),
  };

  if (calcMode === "full" || calcMode === "professional") {
    inputs.distribution =
      root.querySelector('select[name="distribution"]')?.value || "normal";
  }

  if (calcMode === "professional") {
    const mean = root.querySelector('input[name="mean"]')?.value;
    const sigma = root.querySelector('input[name="sigma"]')?.value;
    const kFactor = root.querySelector('input[name="k_factor"]')?.value;
    const lsl = root.querySelector('input[name="lsl"]')?.value;
    const usl = root.querySelector('input[name="usl"]')?.value;
    if (mean !== undefined && mean !== "") {
      inputs.mean = Number(mean);
    }
    if (sigma) {
      inputs.sigma = Number(sigma);
    }
    if (kFactor) {
      inputs.k_factor = Number(kFactor);
    }
    if (lsl !== undefined && lsl !== "") {
      inputs.lsl = Number(lsl);
    }
    if (usl !== undefined && usl !== "") {
      inputs.usl = Number(usl);
    }
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-distribution__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-distribution__status ${
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
  list.className = "mechbox-distribution__result-list";

  list.append(
    resultRow(
      [{ text: t("result_distribution") }],
      [{ text: distLabel(outputs.distribution || "normal") }]
    ),
    resultRow(
      [{ text: `${t("result_k")} ` }, { tex: "K" }],
      [{ text: formatNumber(outputs.k_factor, 2) }]
    ),
    resultRow(
      [{ text: `${t("result_sigma")} ` }, { tex: "\\sigma" }],
      [{ text: formatNumber(outputs.sigma, 4) }]
    ),
    resultRow(
      [{ text: t("result_peak") }],
      [{ text: formatNumber(outputs.peak_density, 4) }]
    ),
    resultRow(
      [{ text: t("result_coverage") }],
      [{ tex: `${formatNumber(Number(outputs.coverage) * 100, 2)}\\%` }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_cv") }],
        [{ text: formatNumber(outputs.cv, 3) }]
      ),
      resultRow(
        [{ text: t("result_half_width") }],
        [{ text: formatNumber(outputs.half_width, 4) }]
      ),
      resultRow(
        [{ text: `${t("result_pdf_sigma")} ` }, { tex: "f(\\mu+\\sigma)" }],
        [{ text: formatNumber(outputs.pdf_at_plus_sigma, 4) }]
      ),
      resultRow(
        [{ text: `${t("result_pdf_3sigma")} ` }, { tex: "f(\\mu+3\\sigma)" }],
        [{ text: formatNumber(outputs.pdf_at_plus_3sigma, 4) }]
      ),
      resultRow(
        [{ text: t("result_curve_points") }],
        [{ text: String(outputs.curve_point_count ?? "—") }]
      )
    );
  }

  if (calcMode === "professional" && outputs.pass_rate != null) {
    list.append(
      resultRow(
        [{ text: t("result_pass_rate") }],
        [{ tex: `${formatNumber(Number(outputs.pass_rate) * 100, 2)}\\%` }]
      ),
      resultRow(
        [{ text: t("result_dppm") }],
        [{ text: String(outputs.dppm ?? "—") }]
      )
    );
  }

  box.append(list);

  if (
    (calcMode === "full" || calcMode === "professional") &&
    Array.isArray(outputs.curve_points) &&
    outputs.curve_points.length
  ) {
    const tableTitle = document.createElement("h4");
    tableTitle.className = "mechbox-distribution__table-title";
    tableTitle.textContent = t("curve_table_title");
    box.append(tableTitle);

    const table = document.createElement("table");
    table.className = "mechbox-distribution__curve-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>${t("curve_x")}</th><th>${t("curve_y")}</th></tr>`;
    const tbody = document.createElement("tbody");
    // Show every other point to keep the table compact.
    outputs.curve_points.forEach((pt, index) => {
      if (index % 2 !== 0 && index !== outputs.curve_points.length - 1) {
        return;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatNumber(pt.x, 4)}</td><td>${formatNumber(
        pt.y,
        5
      )}</td>`;
      tbody.append(tr);
    });
    table.append(thead, tbody);
    box.append(table);
  }

  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-distribution__error");
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

async function calculateDistribution(panel, button) {
  const root = panel.querySelector(".mechbox-distribution");
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
        tool_id: "distribution_chart",
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

export async function mountDistributionChartWorkbench(panel) {
  await ensureKatex();

  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

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
    "mechbox__workbench-panel--fit",
    "mechbox__workbench-panel--distribution"
  );
  panel.classList.add("mechbox__workbench-panel--distribution");

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
  root.className = "mechbox-distribution";

  const modes = document.createElement("div");
  modes.className = "mechbox-distribution__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-distribution__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-distribution__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-distribution__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-distribution__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const distSelect = document.createElement("select");
  distSelect.className = "mechbox__inputs mechbox-distribution__select";
  distSelect.name = "distribution";
  DISTRIBUTIONS.forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = distLabel(key);
    distSelect.append(opt);
  });
  const distRow = fieldRow(
    document.createTextNode(t("distribution")),
    distSelect,
    document.createTextNode("")
  );
  distRow.dataset.calcShow = "full professional";

  const meanRow = fieldRow(
    mixedLabel([{ text: t("mean") }, { text: " " }, { tex: "\\mu" }]),
    numberInput("mean", "0"),
    document.createTextNode("—")
  );
  meanRow.dataset.calcShow = "professional";

  const sigmaRow = fieldRow(
    mixedLabel([{ text: t("sigma") }, { text: " " }, { tex: "\\sigma" }]),
    numberInput("sigma", ""),
    document.createTextNode("—")
  );
  sigmaRow.dataset.calcShow = "professional";
  sigmaRow.querySelector("input").placeholder = t("sigma_placeholder");

  const kRow = fieldRow(
    mixedLabel([{ text: t("k_factor") }, { text: " " }, { tex: "K" }]),
    numberInput("k_factor", ""),
    document.createTextNode("—")
  );
  kRow.dataset.calcShow = "professional";
  kRow.querySelector("input").placeholder = t("k_placeholder");

  const lslRow = fieldRow(
    mixedLabel([{ text: t("lsl") }, { text: " " }, { tex: "LSL" }]),
    numberInput("lsl", ""),
    document.createTextNode("—")
  );
  lslRow.dataset.calcShow = "professional";

  const uslRow = fieldRow(
    mixedLabel([{ text: t("usl") }, { text: " " }, { tex: "USL" }]),
    numberInput("usl", ""),
    document.createTextNode("—")
  );
  uslRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("tolerance") }, { text: " " }, { tex: "T" }]),
      numberInput("tolerance", "0.25"),
      document.createTextNode("—")
    ),
    distRow,
    meanRow,
    sigmaRow,
    kRow,
    lslRow,
    uslRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-distribution__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateDistribution(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-distribution__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-distribution__card mechbox-distribution__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-distribution__results-body";
  resultsBody.innerHTML = `<p class="mechbox-distribution__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
}
