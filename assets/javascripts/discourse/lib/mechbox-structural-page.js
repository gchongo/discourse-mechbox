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
const ANALYSIS = ["pipe_flow", "plate_buckling", "modal"];
const FLUIDS = {
  water: { density: 998, viscosity: 1.002e-3 },
  oil: { density: 870, viscosity: 46e-3 },
  air: { density: 1.2, viscosity: 18.1e-6 },
};
const EDGES = ["ssss", "cccc", "scsc", "sscc"];
const MODAL_CASES = ["sdof", "beam_ss", "beam_cant"];

function t(key, options) {
  return i18n(`mechbox.structural.${key}`, options);
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
  row.className = "mechbox-structural__field";
  const label = document.createElement("label");
  label.className = "mechbox-structural__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-structural__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-structural__unit";
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
  input.className = "mechbox__inputs mechbox-structural__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-structural__select";
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

function getAnalysis(root) {
  return root.querySelector('select[name="analysis_type"]')?.value || "pipe_flow";
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const analysis = getAnalysis(root);
  const modalCase = root.querySelector('select[name="case_id"]')?.value || "beam_ss";

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-analysis-show]").forEach((el) => {
    const types = (el.dataset.analysisShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-analysis-hidden", !types.includes(analysis));
  });

  root.querySelectorAll("[data-modal-show]").forEach((el) => {
    const cases = (el.dataset.modalShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-case-hidden", !cases.includes(modalCase));
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
  const bar = root.querySelector(".mechbox-structural__formula-bar");
  if (!bar) {
    return;
  }

  const analysis = getAnalysis(root);
  const calcMode = getCalcMode(root);

  if (analysis === "pipe_flow") {
    fillFormulaBar(bar, {
      title: t("formula_pipe"),
      hint: calcMode === "simple" ? t("hint_pipe_simple") : t("hint_pipe_full"),
      formulas: [
        "\\Delta p=f\\frac{L}{D}\\frac{\\rho v^{2}}{2}",
        "f=\\frac{0.25}{[\\log_{10}(\\varepsilon/3.7D+5.74/Re^{0.9})]^{2}}",
      ],
    });
  } else if (analysis === "plate_buckling") {
    fillFormulaBar(bar, {
      title: t("formula_plate"),
      hint: t("hint_plate"),
      formulas: [
        "\\sigma_{cr}=k\\frac{\\pi^{2}E}{12(1-\\nu^{2})}\\left(\\frac{t}{b}\\right)^{2}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_modal"),
      hint: t("hint_modal"),
      formulas: ["f_n=\\omega/(2\\pi)", "\\omega=\\sqrt{k/m}"],
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

function applyFluid(root) {
  const key = root.querySelector('select[name="fluid"]')?.value || "water";
  const preset = FLUIDS[key] || FLUIDS.water;
  root.querySelector('input[name="density_kg_m3"]').value = String(preset.density);
  root.querySelector('input[name="dynamic_viscosity_pa_s"]').value = String(preset.viscosity);
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const analysis = getAnalysis(root);
  const inputs = { calc_mode: calcMode, analysis_type: analysis };

  if (analysis === "pipe_flow") {
    inputs.diameter_mm = Number(root.querySelector('input[name="diameter_mm"]')?.value);
    inputs.length_m = Number(root.querySelector('input[name="length_m"]')?.value);
    inputs.flow_rate_lpm = Number(root.querySelector('input[name="flow_rate_lpm"]')?.value);
    inputs.density_kg_m3 = Number(root.querySelector('input[name="density_kg_m3"]')?.value);
    inputs.dynamic_viscosity_pa_s = Number(
      root.querySelector('input[name="dynamic_viscosity_pa_s"]')?.value
    );
    inputs.roughness_mm = Number(root.querySelector('input[name="roughness_mm"]')?.value);
    if (calcMode !== "simple") {
      inputs.local_loss_k = Number(root.querySelector('input[name="local_loss_k"]')?.value || 0);
    }
    if (calcMode === "professional") {
      inputs.max_velocity_mps = Number(
        root.querySelector('input[name="max_velocity_mps"]')?.value || 3
      );
      inputs.max_pressure_drop_kpa = Number(
        root.querySelector('input[name="max_pressure_drop_kpa"]')?.value || 200
      );
    }
  } else if (analysis === "plate_buckling") {
    inputs.edge_condition =
      root.querySelector('select[name="edge_condition"]')?.value || "ssss";
    inputs.thickness_mm = Number(root.querySelector('input[name="thickness_mm"]')?.value);
    inputs.width_mm = Number(root.querySelector('input[name="width_mm"]')?.value);
    inputs.length_mm = Number(root.querySelector('input[name="length_mm"]')?.value);
    inputs.applied_stress_mpa = Number(
      root.querySelector('input[name="applied_stress_mpa"]')?.value || 0
    );
    if (calcMode !== "simple") {
      inputs.applied_stress_transverse_mpa = Number(
        root.querySelector('input[name="applied_stress_transverse_mpa"]')?.value || 0
      );
      inputs.imperfection_factor = Number(
        root.querySelector('input[name="imperfection_factor"]')?.value || 0.8
      );
    }
    if (calcMode === "professional") {
      inputs.applied_shear_mpa = Number(
        root.querySelector('input[name="applied_shear_mpa"]')?.value || 0
      );
    }
  } else {
    inputs.case_id = root.querySelector('select[name="case_id"]')?.value || "sdof";
    if (inputs.case_id === "sdof") {
      inputs.stiffness_n_m = Number(root.querySelector('input[name="stiffness_n_m"]')?.value);
      inputs.mass_kg = Number(root.querySelector('input[name="mass_kg"]')?.value);
    } else {
      inputs.span_length_mm = Number(root.querySelector('input[name="span_length_mm"]')?.value);
      inputs.diameter_mm = Number(root.querySelector('input[name="modal_diameter_mm"]')?.value);
    }
    const exc = root.querySelector('input[name="excitation_freq_hz"]')?.value;
    if (exc) {
      inputs.excitation_freq_hz = Number(exc);
    }
    if (calcMode !== "simple") {
      const rpm = root.querySelector('input[name="rpm"]')?.value;
      if (rpm) {
        inputs.rpm = Number(rpm);
      }
    }
    if (calcMode === "professional") {
      inputs.damping_ratio = Number(
        root.querySelector('input[name="damping_ratio"]')?.value || 0.02
      );
    }
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-structural__result-row";
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
  const box = panel.querySelector(".mechbox-structural__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const analysis = outputs.analysis_type || "pipe_flow";
  box.replaceChildren();
  box.classList.add("is-visible");

  const hasPass = typeof outputs.pass === "boolean";
  const status = document.createElement("div");
  status.className = `mechbox-structural__status ${
    hasPass ? (outputs.pass ? "is-pass" : "is-attention") : "is-attention"
  }`;
  status.textContent = `${t("overall")}: ${
    hasPass
      ? outputs.pass
        ? t("status_pass")
        : t("status_attention")
      : t("status_estimate")
  }`;
  box.append(status);

  const list = document.createElement("dl");
  list.className = "mechbox-structural__result-list";

  if (analysis === "pipe_flow") {
    list.append(
      resultRow(
        [{ text: t("result_velocity") }],
        [{ text: `${formatNumber(outputs.velocity_mps, 3)} m/s` }]
      ),
      resultRow(
        [{ text: t("result_reynolds") }],
        [{ text: `${formatNumber(outputs.reynolds, 0)} (${outputs.flow_regime || "—"})` }]
      ),
      resultRow(
        [{ text: t("result_friction_drop") }],
        [{ text: `${formatNumber(outputs.pressure_drop_kpa, 2)} kPa` }]
      ),
      resultRow(
        [{ text: t("result_total_drop") }],
        [{ text: `${formatNumber(outputs.total_pressure_drop_kpa, 2)} kPa` }]
      )
    );
    if (outputs.method_compare) {
      list.append(
        resultRow(
          [{ text: t("result_hazen") }],
          [{ text: `${formatNumber(outputs.method_compare.hazen_kpa, 2)} kPa` }]
        )
      );
    }
    if (outputs.erosion_risk) {
      list.append(
        resultRow([{ text: t("result_erosion") }], [{ text: outputs.erosion_risk }])
      );
    }
  } else if (analysis === "plate_buckling") {
    list.append(
      resultRow(
        [{ text: t("result_crit_stress") }],
        [{ text: `${formatNumber(outputs.critical_stress_mpa, 1)} MPa` }]
      ),
      resultRow(
        [{ text: t("result_safety") }],
        [{ text: formatNumber(outputs.safety_factor, 2) }],
        { danger: outputs.pass === false }
      ),
      resultRow(
        [{ text: t("result_k") }],
        [{ text: formatNumber(outputs.buckling_coefficient, 3) }]
      )
    );
    if (outputs.utilization != null) {
      list.append(
        resultRow(
          [{ text: t("result_util") }],
          [{ text: `${formatNumber(outputs.utilization * 100, 1)}%` }]
        )
      );
    }
    if (outputs.post_buckling_reserve_mpa != null) {
      list.append(
        resultRow(
          [{ text: t("result_post") }],
          [{ text: `${formatNumber(outputs.post_buckling_reserve_mpa, 1)} MPa` }]
        )
      );
    }
  } else {
    const modal = outputs.modal || {};
    list.append(
      resultRow(
        [{ text: t("result_fn") }],
        [{ text: `${formatNumber(modal.fn_hz, 2)} Hz` }]
      )
    );
    if (outputs.critical_speed_rpm != null) {
      list.append(
        resultRow(
          [{ text: t("result_crit_rpm") }],
          [{ text: `${formatNumber(outputs.critical_speed_rpm, 0)} rpm` }]
        )
      );
    }
    if (outputs.resonance) {
      list.append(
        resultRow(
          [{ text: t("result_margin") }],
          [{ text: `${formatNumber(outputs.resonance.margin_percent, 1)}%` }],
          { danger: outputs.resonance.pass === false }
        )
      );
    }
    if (outputs.amplification_factor != null) {
      list.append(
        resultRow(
          [{ text: t("result_amp") }],
          [{ text: formatNumber(outputs.amplification_factor, 2) }]
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-structural__error");
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

async function calculateStructural(panel, button) {
  const root = panel.querySelector(".mechbox-structural");
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
        tool_id: "structural",
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

export async function mountStructuralWorkbench(panel) {
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
    "mechbox__workbench-panel--shaft",
    "mechbox__workbench-panel--gear-ratio",
    "mechbox__workbench-panel--gear",
    "mechbox__workbench-panel--fatigue",
    "mechbox__workbench-panel--beam",
    "mechbox__workbench-panel--sheet-metal",
    "mechbox__workbench-panel--cylinder",
    "mechbox__workbench-panel--o-ring",
    "mechbox__workbench-panel--structural"
  );
  panel.classList.add("mechbox__workbench-panel--structural");

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
  root.className = "mechbox-structural";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-structural__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-structural__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-structural__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-structural__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-structural__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const analysisSelect = selectInput(
    "analysis_type",
    ANALYSIS.map((id) => [id, t(`analysis_${id}`)]),
    "pipe_flow"
  );
  analysisSelect.addEventListener("change", () => {
    syncVisibility(root);
    updateFormulaBar(root);
  });
  inputsCard.append(
    fieldRow(document.createTextNode(t("analysis")), analysisSelect, document.createTextNode(""))
  );

  // Pipe fields
  const fluidSelect = selectInput(
    "fluid",
    Object.keys(FLUIDS).map((id) => [id, t(`fluid_${id}`)]),
    "water"
  );
  fluidSelect.addEventListener("change", () => applyFluid(root));
  const fluidRow = fieldRow(
    document.createTextNode(t("fluid")),
    fluidSelect,
    document.createTextNode("")
  );
  fluidRow.dataset.analysisShow = "pipe_flow";
  inputsCard.append(fluidRow);

  const pipeFields = [
    ["diameter_mm", "pipe_diameter", "25", "mm"],
    ["length_m", "pipe_length", "10", "m"],
    ["flow_rate_lpm", "flow_rate", "20", "L/min"],
    ["density_kg_m3", "density", "998", "kg/m³"],
    ["dynamic_viscosity_pa_s", "viscosity", "0.001002", "Pa·s"],
    ["roughness_mm", "roughness", "0.045", "mm"],
  ];
  pipeFields.forEach(([name, labelKey, value, unit]) => {
    const row = fieldRow(
      document.createTextNode(t(labelKey)),
      numberInput(name, value),
      document.createTextNode(unit)
    );
    row.dataset.analysisShow = "pipe_flow";
    inputsCard.append(row);
  });

  const localRow = fieldRow(
    document.createTextNode(t("local_loss")),
    numberInput("local_loss_k", "2"),
    document.createTextNode("-")
  );
  localRow.dataset.analysisShow = "pipe_flow";
  localRow.dataset.calcShow = "full professional";
  inputsCard.append(localRow);

  const maxVRow = fieldRow(
    document.createTextNode(t("max_velocity")),
    numberInput("max_velocity_mps", "3"),
    document.createTextNode("m/s")
  );
  maxVRow.dataset.analysisShow = "pipe_flow";
  maxVRow.dataset.calcShow = "professional";
  inputsCard.append(maxVRow);

  const maxDpRow = fieldRow(
    document.createTextNode(t("max_pressure_drop")),
    numberInput("max_pressure_drop_kpa", "200"),
    document.createTextNode("kPa")
  );
  maxDpRow.dataset.analysisShow = "pipe_flow";
  maxDpRow.dataset.calcShow = "professional";
  inputsCard.append(maxDpRow);

  // Plate fields
  const edgeRow = fieldRow(
    document.createTextNode(t("edge")),
    selectInput(
      "edge_condition",
      EDGES.map((id) => [id, t(`edge_${id}`)]),
      "ssss"
    ),
    document.createTextNode("")
  );
  edgeRow.dataset.analysisShow = "plate_buckling";
  inputsCard.append(edgeRow);

  [
    ["thickness_mm", "plate_thickness", "2", "mm"],
    ["width_mm", "plate_width", "200", "mm"],
    ["length_mm", "plate_length", "400", "mm"],
    ["applied_stress_mpa", "applied_stress", "50", "MPa"],
  ].forEach(([name, labelKey, value, unit]) => {
    const row = fieldRow(
      document.createTextNode(t(labelKey)),
      numberInput(name, value),
      document.createTextNode(unit)
    );
    row.dataset.analysisShow = "plate_buckling";
    inputsCard.append(row);
  });

  const transverseRow = fieldRow(
    document.createTextNode(t("transverse_stress")),
    numberInput("applied_stress_transverse_mpa", "0"),
    document.createTextNode("MPa")
  );
  transverseRow.dataset.analysisShow = "plate_buckling";
  transverseRow.dataset.calcShow = "full professional";
  inputsCard.append(transverseRow);

  const imperfRow = fieldRow(
    document.createTextNode(t("imperfection")),
    numberInput("imperfection_factor", "0.8"),
    document.createTextNode("-")
  );
  imperfRow.dataset.analysisShow = "plate_buckling";
  imperfRow.dataset.calcShow = "full professional";
  inputsCard.append(imperfRow);

  const shearRow = fieldRow(
    document.createTextNode(t("shear_stress")),
    numberInput("applied_shear_mpa", "0"),
    document.createTextNode("MPa")
  );
  shearRow.dataset.analysisShow = "plate_buckling";
  shearRow.dataset.calcShow = "professional";
  inputsCard.append(shearRow);

  // Modal fields
  const caseSelect = selectInput(
    "case_id",
    MODAL_CASES.map((id) => [id, t(`modal_${id}`)]),
    "beam_ss"
  );
  caseSelect.addEventListener("change", () => syncVisibility(root));
  const caseRow = fieldRow(
    document.createTextNode(t("modal_case")),
    caseSelect,
    document.createTextNode("")
  );
  caseRow.dataset.analysisShow = "modal";
  inputsCard.append(caseRow);

  const stiffRow = fieldRow(
    document.createTextNode(t("stiffness")),
    numberInput("stiffness_n_m", "10000"),
    document.createTextNode("N/m")
  );
  stiffRow.dataset.analysisShow = "modal";
  stiffRow.dataset.modalShow = "sdof";
  inputsCard.append(stiffRow);

  const massRow = fieldRow(
    document.createTextNode(t("mass")),
    numberInput("mass_kg", "10"),
    document.createTextNode("kg")
  );
  massRow.dataset.analysisShow = "modal";
  massRow.dataset.modalShow = "sdof";
  inputsCard.append(massRow);

  const spanRow = fieldRow(
    document.createTextNode(t("span")),
    numberInput("span_length_mm", "500"),
    document.createTextNode("mm")
  );
  spanRow.dataset.analysisShow = "modal";
  spanRow.dataset.modalShow = "beam_ss beam_cant";
  inputsCard.append(spanRow);

  const modalDRow = fieldRow(
    document.createTextNode(t("modal_diameter")),
    numberInput("modal_diameter_mm", "30"),
    document.createTextNode("mm")
  );
  modalDRow.dataset.analysisShow = "modal";
  modalDRow.dataset.modalShow = "beam_ss beam_cant";
  inputsCard.append(modalDRow);

  const excRow = fieldRow(
    document.createTextNode(t("excitation")),
    numberInput("excitation_freq_hz", ""),
    document.createTextNode("Hz")
  );
  excRow.dataset.analysisShow = "modal";
  inputsCard.append(excRow);

  const rpmRow = fieldRow(
    document.createTextNode(t("rpm")),
    numberInput("rpm", ""),
    document.createTextNode("rpm")
  );
  rpmRow.dataset.analysisShow = "modal";
  rpmRow.dataset.calcShow = "full professional";
  inputsCard.append(rpmRow);

  const dampRow = fieldRow(
    document.createTextNode(t("damping")),
    numberInput("damping_ratio", "0.02"),
    document.createTextNode("-")
  );
  dampRow.dataset.analysisShow = "modal";
  dampRow.dataset.calcShow = "professional";
  inputsCard.append(dampRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-structural__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateStructural(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-structural__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-structural__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-structural__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
