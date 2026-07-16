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

const COMMON_FITS = [
  { hole: "H7", shaft: "g6", key: "preset_h7_g6" },
  { hole: "H7", shaft: "h6", key: "preset_h7_h6" },
  { hole: "H7", shaft: "k6", key: "preset_h7_k6" },
  { hole: "H7", shaft: "p6", key: "preset_h7_p6" },
  { hole: "H8", shaft: "f7", key: "preset_h8_f7" },
  { hole: "H8", shaft: "h7", key: "preset_h8_h7" },
  { hole: "H9", shaft: "d9", key: "preset_h9_d9" },
];

function t(key, options) {
  return i18n(`mechbox.fit.${key}`, options);
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function um(valueMm) {
  const num = Number(valueMm);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return formatNumber(num * 1000, 2);
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-fit__field";
  const label = document.createElement("label");
  label.className = "mechbox-fit__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-fit__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-fit__unit";
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
  input.className = "mechbox__inputs mechbox-fit__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function textInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "mechbox__inputs mechbox-fit__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
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
  const bar = root.querySelector(".mechbox-fit__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "i=0.45D^{1/3}+0.001D",
        "X_{\\max}=D_{\\mathrm{h,max}}-d_{\\mathrm{s,min}}",
        "X_{\\min}=D_{\\mathrm{h,min}}-d_{\\mathrm{s,max}}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\bar{X}=(X_{\\max}+X_{\\min})/2",
        "Q=\\bar{X}/(X_{\\max}-X_{\\min})",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "\\Delta X_{\\mathrm{th}}=\\alpha_{\\mathrm{h}}D\\Delta T-\\alpha_{\\mathrm{s}}D\\Delta T",
        "X_{\\mathrm{hot}}=X+\\Delta X_{\\mathrm{th}}",
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
  row.className = "mechbox-fit__result-row";
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

function fitTypeLabel(fitType) {
  if (fitType === "clearance") {
    return t("fit_clearance");
  }
  if (fitType === "interference") {
    return t("fit_interference");
  }
  if (fitType === "transition") {
    return t("fit_transition");
  }
  return fitType || "—";
}

function thermalRiskLabel(key) {
  if (!key) {
    return t("thermal_risk_none");
  }
  if (key === "thermal_interference_risk") {
    return t("thermal_interference_risk");
  }
  if (key === "thermal_clearance_risk") {
    return t("thermal_clearance_risk");
  }
  return key;
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    nominal_mm: Number(root.querySelector('input[name="nominal_mm"]')?.value),
    hole_code: root.querySelector('input[name="hole_code"]')?.value || "",
    shaft_code: root.querySelector('input[name="shaft_code"]')?.value || "",
  };

  if (calcMode === "professional") {
    inputs.delta_t = Number(root.querySelector('input[name="delta_t"]')?.value || 0);
    const alphaHole = root.querySelector('input[name="alpha_hole"]')?.value;
    const alphaShaft = root.querySelector('input[name="alpha_shaft"]')?.value;
    if (alphaHole) {
      inputs.alpha_hole = Number(alphaHole);
    }
    if (alphaShaft) {
      inputs.alpha_shaft = Number(alphaShaft);
    }
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-fit__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-fit__status ${
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
  list.className = "mechbox-fit__result-list";

  list.append(
    resultRow([{ text: t("result_fit_type") }], [{ text: fitTypeLabel(outputs.fit_type) }]),
    resultRow(
      [{ text: `${t("result_max_clearance")} ` }, { tex: "X_{\\max}" }],
      [{ tex: `${um(outputs.max_clearance)}\\,\\mathrm{\\mu m}` }]
    ),
    resultRow(
      [{ text: `${t("result_min_clearance")} ` }, { tex: "X_{\\min}" }],
      [{ tex: `${um(outputs.min_clearance)}\\,\\mathrm{\\mu m}` }]
    ),
    resultRow(
      [{ text: t("result_hole_limits") }],
      [
        {
          text: `${formatNumber(outputs.hole?.min_size, 4)} ~ ${formatNumber(
            outputs.hole?.max_size,
            4
          )} mm`,
        },
      ]
    ),
    resultRow(
      [{ text: t("result_shaft_limits") }],
      [
        {
          text: `${formatNumber(outputs.shaft?.min_size, 4)} ~ ${formatNumber(
            outputs.shaft?.max_size,
            4
          )} mm`,
        },
      ]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: `${t("result_mean_clearance")} ` }, { tex: "\\bar{X}" }],
        [{ tex: `${um(outputs.mean_clearance)}\\,\\mathrm{\\mu m}` }]
      ),
      resultRow(
        [{ text: t("result_fit_quality") }],
        [{ text: formatNumber(outputs.fit_quality, 2) }]
      )
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_thermal_shift") }],
        [{ tex: `${um(outputs.thermal_shift)}\\,\\mathrm{\\mu m}` }]
      ),
      resultRow(
        [{ text: t("result_min_clearance_hot") }],
        [{ tex: `${um(outputs.min_clearance_hot)}\\,\\mathrm{\\mu m}` }],
        { danger: outputs.pass === false && !!outputs.thermal_risk_key }
      ),
      resultRow(
        [{ text: t("result_max_clearance_hot") }],
        [{ tex: `${um(outputs.max_clearance_hot)}\\,\\mathrm{\\mu m}` }]
      ),
      resultRow(
        [{ text: t("result_thermal_risk") }],
        [{ text: thermalRiskLabel(outputs.thermal_risk_key) }],
        { danger: !!outputs.thermal_risk_key }
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-fit__error");
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

async function calculateFit(panel, button) {
  const root = panel.querySelector(".mechbox-fit");
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
        tool_id: "fit",
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

function applyPreset(root, index) {
  const preset = COMMON_FITS[index];
  if (!preset) {
    return;
  }
  const hole = root.querySelector('input[name="hole_code"]');
  const shaft = root.querySelector('input[name="shaft_code"]');
  if (hole) {
    hole.value = preset.hole;
  }
  if (shaft) {
    shaft.value = preset.shaft;
  }
}

export async function mountFitWorkbench(panel) {
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
    "mechbox__workbench-panel--fit"
  );
  panel.classList.add("mechbox__workbench-panel--fit");

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
  root.className = "mechbox-fit";

  const modes = document.createElement("div");
  modes.className = "mechbox-fit__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-fit__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-fit__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-fit__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-fit__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const presetSelect = document.createElement("select");
  presetSelect.className = "mechbox__inputs mechbox-fit__select";
  presetSelect.name = "preset";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = t("preset_none");
  presetSelect.append(emptyOpt);
  COMMON_FITS.forEach((preset, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = t(preset.key);
    presetSelect.append(opt);
  });
  presetSelect.addEventListener("change", () => {
    if (presetSelect.value === "") {
      return;
    }
    applyPreset(root, Number(presetSelect.value));
  });
  const presetRow = fieldRow(
    document.createTextNode(t("preset")),
    presetSelect,
    document.createTextNode("")
  );
  presetRow.dataset.calcShow = "full professional";

  const deltaRow = fieldRow(
    mixedLabel([{ text: t("delta_t") }, { text: " " }, { tex: "\\Delta T" }]),
    numberInput("delta_t", "0"),
    document.createTextNode("°C")
  );
  deltaRow.dataset.calcShow = "professional";

  const alphaHoleRow = fieldRow(
    mixedLabel([{ text: t("alpha_hole") }, { text: " " }, { tex: "\\alpha_{\\mathrm{h}}" }]),
    numberInput("alpha_hole", "0.0000115"),
    document.createTextNode("/°C")
  );
  alphaHoleRow.dataset.calcShow = "professional";

  const alphaShaftRow = fieldRow(
    mixedLabel([{ text: t("alpha_shaft") }, { text: " " }, { tex: "\\alpha_{\\mathrm{s}}" }]),
    numberInput("alpha_shaft", "0.0000115"),
    document.createTextNode("/°C")
  );
  alphaShaftRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("nominal") }, { text: " " }, { tex: "D" }]),
      numberInput("nominal_mm", "25"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("hole_code")),
      textInput("hole_code", "H7"),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("shaft_code")),
      textInput("shaft_code", "g6"),
      document.createTextNode("")
    ),
    presetRow,
    deltaRow,
    alphaHoleRow,
    alphaShaftRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-fit__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateFit(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-fit__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-fit__card mechbox-fit__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-fit__results-body";
  resultsBody.innerHTML = `<p class="mechbox-fit__results-empty">${t("results_empty")}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
}
