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
const ANALYSIS_MODES = ["torsion", "combined"];
const MATERIALS = [
  ["q235", "Q235"],
  ["q345", "Q345"],
  ["45", "45"],
  ["40cr", "40Cr"],
  ["42crmo", "42CrMo"],
  ["304", "304"],
];

function t(key, options) {
  return i18n(`mechbox.shaft.${key}`, options);
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
  row.className = "mechbox-shaft__field";
  const label = document.createElement("label");
  label.className = "mechbox-shaft__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-shaft__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-shaft__unit";
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
  input.className = "mechbox__inputs mechbox-shaft__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-shaft__select";
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

function getAnalysisMode(root) {
  return root.dataset.analysisMode || "torsion";
}

function setAnalysisMode(root, mode) {
  root.dataset.analysisMode = mode;
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const analysisMode = getAnalysisMode(root);

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-analysis-show]").forEach((el) => {
    const modes = (el.dataset.analysisShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-analysis-hidden", !modes.includes(analysisMode));
  });
}

function syncModeTabs(root) {
  const calcMode = getCalcMode(root);
  const analysisMode = getAnalysisMode(root);
  root.querySelectorAll("[data-calc-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.calcMode === calcMode);
  });
  root.querySelectorAll("[data-analysis-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.analysisMode === analysisMode);
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

function analysisTabLabel(mode) {
  return mode === "combined" ? t("tab_combined") : t("tab_torsion");
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-shaft__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  const analysisMode = getAnalysisMode(root);

  if (analysisMode === "combined") {
    if (calcMode === "simple") {
      fillFormulaBar(bar, {
        title: t("formula_title_combined"),
        hint: t("estimate_warning"),
        formulas: ["\\sigma_{eq}=\\sqrt{\\sigma^{2}+3\\tau^{2}}"],
      });
    } else if (calcMode === "full") {
      fillFormulaBar(bar, {
        title: t("formula_title_combined_full"),
        hint: t("estimate_warning_full"),
        formulas: [
          "\\sigma=M/W",
          "\\tau=T r/J",
          "\\sigma_{eq}=\\sqrt{\\sigma^{2}+3\\tau^{2}}",
        ],
      });
    } else {
      fillFormulaBar(bar, {
        title: t("formula_title_combined_pro"),
        hint: t("estimate_warning_pro"),
        formulas: [
          "\\sigma'=K_{t}\\sigma",
          "\\tau'=K_{\\tau}\\tau",
          "\\sigma_{eq}=\\sqrt{\\sigma'^{2}+3\\tau'^{2}}",
        ],
      });
    }
  } else if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["\\tau=16T/(\\pi d^{3})"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\tau=T r/J",
        "\\theta=T L/(G J)",
        "J=\\pi(d^{4}-d_{i}^{4})/32",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["\\tau_{peak}=K_{t}\\tau", "d_{min}\\Leftarrow\\tau\\le[\\tau]"],
    });
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function applyAnalysisMode(root, mode) {
  setAnalysisMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const analysisMode = getAnalysisMode(root);
  const inputs = {
    calc_mode: calcMode,
    analysis_mode: analysisMode,
    material_id: root.querySelector('select[name="material_id"]')?.value || "q235",
    diameter_mm: Number(root.querySelector('input[name="diameter_mm"]')?.value),
    torque_nm: Number(root.querySelector('input[name="torque_nm"]')?.value),
  };

  if (calcMode !== "simple") {
    inputs.inner_diameter_mm = Number(
      root.querySelector('input[name="inner_diameter_mm"]')?.value || 0
    );
    inputs.yield_strength_mpa = Number(
      root.querySelector('input[name="yield_strength_mpa"]')?.value || 0
    );
  }

  if (analysisMode === "torsion") {
    inputs.length_mm = Number(root.querySelector('input[name="length_mm"]')?.value || 500);
    const allow = root.querySelector('input[name="allowable_shear_mpa"]')?.value;
    if (allow) {
      inputs.allowable_shear_mpa = Number(allow);
    }
    if (calcMode !== "simple") {
      const maxTwist = root.querySelector('input[name="max_twist_angle_deg"]')?.value;
      if (maxTwist) {
        inputs.max_twist_angle_deg = Number(maxTwist);
      }
    }
  } else {
    inputs.bending_moment_nm = Number(
      root.querySelector('input[name="bending_moment_nm"]')?.value || 0
    );
    inputs.strength_theory =
      root.querySelector('select[name="strength_theory"]')?.value || "vonMises";
    const allow = root.querySelector('input[name="allowable_stress_mpa"]')?.value;
    if (allow) {
      inputs.allowable_stress_mpa = Number(allow);
    }
  }

  if (calcMode === "professional") {
    if (analysisMode === "torsion" || analysisMode === "combined") {
      inputs.stress_concentration_torsion = Number(
        root.querySelector('input[name="stress_concentration_torsion"]')?.value || 1
      );
    }
    if (analysisMode === "combined") {
      inputs.stress_concentration_bending = Number(
        root.querySelector('input[name="stress_concentration_bending"]')?.value || 1
      );
    }
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-shaft__result-row";
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

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-shaft__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  const analysisMode = outputs.analysis_mode || "torsion";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-shaft__status ${
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
  list.className = "mechbox-shaft__result-list";

  if (analysisMode === "torsion") {
    list.append(
      resultRow(
        [{ text: `${t("result_shear")} ` }, { tex: "\\tau" }],
        [{ tex: `${formatNumber(outputs.shear_stress_mpa, 2)}\\,\\mathrm{MPa}` }],
        { danger: outputs.torsion_pass === false }
      ),
      resultRow(
        [{ text: `${t("result_twist")} ` }, { tex: "\\theta" }],
        [{ text: `${formatNumber(outputs.twist_angle_deg, 4)}°` }],
        { danger: outputs.angle_pass === false }
      )
    );
    if (calcMode !== "simple") {
      list.append(
        resultRow(
          [{ text: `${t("result_min_diameter")} ` }, { tex: "d_{min}" }],
          [{ text: `${formatNumber(outputs.min_diameter_mm, 1)} mm` }]
        )
      );
    }
    if (calcMode === "professional" && outputs.peak_shear_stress_mpa != null) {
      list.append(
        resultRow(
          [{ text: `${t("result_peak_shear")} ` }, { tex: "\\tau_{peak}" }],
          [{ tex: `${formatNumber(outputs.peak_shear_stress_mpa, 2)}\\,\\mathrm{MPa}` }],
          { danger: outputs.peak_pass === false }
        )
      );
    }
  } else {
    list.append(
      resultRow(
        [{ text: `${t("result_bending")} ` }, { tex: "\\sigma" }],
        [{ tex: `${formatNumber(outputs.bending_stress_mpa, 2)}\\,\\mathrm{MPa}` }],
        { danger: outputs.bending_pass === false }
      ),
      resultRow(
        [{ text: `${t("result_torsion")} ` }, { tex: "\\tau" }],
        [{ tex: `${formatNumber(outputs.shear_stress_mpa, 2)}\\,\\mathrm{MPa}` }],
        { danger: outputs.torsion_pass === false }
      ),
      resultRow(
        [{ text: `${t("result_equivalent")} ` }, { tex: "\\sigma_{eq}" }],
        [{ tex: `${formatNumber(outputs.equivalent_stress_mpa, 2)}\\,\\mathrm{MPa}` }],
        { danger: outputs.combined_pass === false }
      ),
      resultRow(
        [{ text: t("result_utilization") }],
        [{ text: `${formatNumber((outputs.utilization || 0) * 100, 1)}%` }]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-shaft__error");
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

async function calculateShaft(panel, button) {
  const root = panel.querySelector(".mechbox-shaft");
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
        tool_id: "shaft",
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

export async function mountShaftWorkbench(panel) {
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
    "mechbox__workbench-panel--distribution",
    "mechbox__workbench-panel--thermal",
    "mechbox__workbench-panel--interference",
    "mechbox__workbench-panel--bearing",
    "mechbox__workbench-panel--shaft"
  );
  panel.classList.add("mechbox__workbench-panel--shaft");

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
  root.className = "mechbox-shaft";
  setCalcMode(root, "simple");
  setAnalysisMode(root, "torsion");

  const modes = document.createElement("div");
  modes.className = "mechbox-shaft__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-shaft__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const analysisTabs = document.createElement("div");
  analysisTabs.className = "mechbox-shaft__modes";
  ANALYSIS_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-shaft__mode-tab";
    btn.dataset.analysisMode = mode;
    btn.textContent = analysisTabLabel(mode);
    btn.addEventListener("click", () => applyAnalysisMode(root, mode));
    analysisTabs.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-shaft__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-shaft__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-shaft__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("material")),
      selectInput("material_id", MATERIALS, "q235"),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("diameter")),
      numberInput("diameter_mm", "40"),
      document.createTextNode("mm")
    )
  );

  const innerRow = fieldRow(
    document.createTextNode(t("inner_diameter")),
    numberInput("inner_diameter_mm", "0"),
    document.createTextNode("mm")
  );
  innerRow.dataset.calcShow = "full professional";
  inputsCard.append(innerRow);

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("torque")),
      numberInput("torque_nm", "200"),
      document.createTextNode("N·m")
    )
  );

  const lengthRow = fieldRow(
    document.createTextNode(t("length")),
    numberInput("length_mm", "500"),
    document.createTextNode("mm")
  );
  lengthRow.dataset.analysisShow = "torsion";
  inputsCard.append(lengthRow);

  const bendingRow = fieldRow(
    document.createTextNode(t("bending_moment")),
    numberInput("bending_moment_nm", "150"),
    document.createTextNode("N·m")
  );
  bendingRow.dataset.analysisShow = "combined";
  inputsCard.append(bendingRow);

  const yieldRow = fieldRow(
    document.createTextNode(t("yield_strength")),
    numberInput("yield_strength_mpa", "235"),
    document.createTextNode("MPa")
  );
  yieldRow.dataset.calcShow = "full professional";
  inputsCard.append(yieldRow);

  const shearAllowRow = fieldRow(
    document.createTextNode(t("allowable_shear")),
    numberInput("allowable_shear_mpa", ""),
    document.createTextNode("MPa")
  );
  shearAllowRow.dataset.analysisShow = "torsion";
  shearAllowRow.dataset.calcShow = "full professional";
  inputsCard.append(shearAllowRow);

  const stressAllowRow = fieldRow(
    document.createTextNode(t("allowable_stress")),
    numberInput("allowable_stress_mpa", ""),
    document.createTextNode("MPa")
  );
  stressAllowRow.dataset.analysisShow = "combined";
  stressAllowRow.dataset.calcShow = "full professional";
  inputsCard.append(stressAllowRow);

  const theoryRow = fieldRow(
    document.createTextNode(t("strength_theory")),
    selectInput(
      "strength_theory",
      [
        ["vonMises", t("theory_von_mises")],
        ["third", t("theory_third")],
      ],
      "vonMises"
    ),
    document.createTextNode("")
  );
  theoryRow.dataset.analysisShow = "combined";
  theoryRow.dataset.calcShow = "full professional";
  inputsCard.append(theoryRow);

  const maxTwistRow = fieldRow(
    document.createTextNode(t("max_twist")),
    numberInput("max_twist_angle_deg", ""),
    document.createTextNode("°")
  );
  maxTwistRow.dataset.analysisShow = "torsion";
  maxTwistRow.dataset.calcShow = "full professional";
  inputsCard.append(maxTwistRow);

  const ktTRow = fieldRow(
    document.createTextNode(t("kt_torsion")),
    numberInput("stress_concentration_torsion", "1.5"),
    document.createTextNode("-")
  );
  ktTRow.dataset.calcShow = "professional";
  inputsCard.append(ktTRow);

  const ktBRow = fieldRow(
    document.createTextNode(t("kt_bending")),
    numberInput("stress_concentration_bending", "1.5"),
    document.createTextNode("-")
  );
  ktBRow.dataset.calcShow = "professional";
  ktBRow.dataset.analysisShow = "combined";
  inputsCard.append(ktBRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-shaft__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateShaft(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-shaft__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-shaft__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-shaft__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, analysisTabs, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
