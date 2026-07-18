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
const CASES = [
  "simply_center",
  "cantilever_end",
  "simply_uniform",
  "cantilever_uniform",
];
const SECTIONS = ["solid_round", "hollow_round", "rectangle"];
const MATERIALS = ["q235", "q345", "45", "40cr", "304", "6061-t6"];

function t(key, options) {
  return i18n(`mechbox.beam.${key}`, options);
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
  row.className = "mechbox-beam__field";
  const label = document.createElement("label");
  label.className = "mechbox-beam__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-beam__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-beam__unit";
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
  input.className = "mechbox__inputs mechbox-beam__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-beam__select";
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

function isUniformCase(caseId) {
  return caseId === "simply_uniform" || caseId === "cantilever_uniform";
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const caseId = root.querySelector('select[name="case_id"]')?.value || "simply_center";
  const section = root.querySelector('select[name="section_type"]')?.value || "solid_round";

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-case-show]").forEach((el) => {
    const cases = (el.dataset.caseShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-case-hidden", !cases.includes(caseId));
  });

  root.querySelectorAll("[data-section-show]").forEach((el) => {
    const sections = (el.dataset.sectionShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-section-hidden", !sections.includes(section));
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
  const bar = root.querySelector(".mechbox-beam__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "\\sigma=M/W",
        "\\delta=F L^{3}/(48 E I)",
        "I_{\\mathrm{round}}=\\pi d^{4}/64",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["\\eta_{\\sigma}=\\sigma/[\\sigma]", "\\eta_{\\delta}=\\delta/[\\delta]"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["F_d=K_d F", "\\sigma_d=K_t M/W"],
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

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const caseId = root.querySelector('select[name="case_id"]')?.value || "simply_center";
  const section = root.querySelector('select[name="section_type"]')?.value || "solid_round";
  const inputs = {
    calc_mode: calcMode,
    case_id: caseId,
    section_type: section,
    material_id: root.querySelector('select[name="material_id"]')?.value || "q235",
    span_length_mm: Number(root.querySelector('input[name="span_length_mm"]')?.value),
  };

  if (isUniformCase(caseId)) {
    inputs.line_load_n_per_mm = Number(
      root.querySelector('input[name="line_load_n_per_mm"]')?.value
    );
  } else {
    inputs.load_n = Number(root.querySelector('input[name="load_n"]')?.value);
  }

  if (section === "rectangle") {
    inputs.width_mm = Number(root.querySelector('input[name="width_mm"]')?.value);
    inputs.height_mm = Number(root.querySelector('input[name="height_mm"]')?.value);
  } else {
    inputs.diameter_mm = Number(root.querySelector('input[name="diameter_mm"]')?.value);
    if (section === "hollow_round") {
      inputs.inner_diameter_mm = Number(
        root.querySelector('input[name="inner_diameter_mm"]')?.value || 0
      );
    }
  }

  if (calcMode !== "simple") {
    const e = root.querySelector('input[name="elastic_modulus_mpa"]')?.value;
    const allowS = root.querySelector('input[name="allowable_stress_mpa"]')?.value;
    const allowD = root.querySelector('input[name="allowable_deflection_mm"]')?.value;
    if (e) {
      inputs.elastic_modulus_mpa = Number(e);
    }
    if (allowS) {
      inputs.allowable_stress_mpa = Number(allowS);
    }
    if (allowD) {
      inputs.allowable_deflection_mm = Number(allowD);
    }
  }

  if (calcMode === "professional") {
    inputs.dynamic_factor = Number(
      root.querySelector('input[name="dynamic_factor"]')?.value || 1
    );
    inputs.stress_concentration = Number(
      root.querySelector('input[name="stress_concentration"]')?.value || 1
    );
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-beam__result-row";
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
  const box = panel.querySelector(".mechbox-beam__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-beam__status ${
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
  list.className = "mechbox-beam__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_moment")} ` }, { tex: "M" }],
      [{ tex: `${formatNumber(outputs.moment_nmm, 1)}\\,\\mathrm{N\\cdot mm}` }]
    ),
    resultRow(
      [{ text: `${t("result_stress")} ` }, { tex: "\\sigma" }],
      [{ tex: `${formatNumber(outputs.stress_mpa, 2)}\\,\\mathrm{MPa}` }],
      { danger: outputs.stress_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_deflection")} ` }, { tex: "\\delta" }],
      [{ tex: `${formatNumber(outputs.deflection_mm, 4)}\\,\\mathrm{mm}` }],
      { danger: outputs.deflection_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_inertia")} ` }, { tex: "I" }],
      [{ tex: `${formatNumber(outputs.inertia_mm4, 1)}\\,\\mathrm{mm^{4}}` }]
    ),
    resultRow(
      [{ text: `${t("result_modulus")} ` }, { tex: "W" }],
      [{ tex: `${formatNumber(outputs.section_modulus_mm3, 1)}\\,\\mathrm{mm^{3}}` }]
    )
  );

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: t("result_stress_util") }],
        [{ text: `${formatNumber((outputs.stress_utilization || 0) * 100, 1)}%` }],
        { danger: outputs.stress_pass === false }
      ),
      resultRow(
        [{ text: t("result_defl_util") }],
        [{ text: `${formatNumber((outputs.deflection_utilization || 0) * 100, 1)}%` }],
        { danger: outputs.deflection_pass === false }
      )
    );
  }

  if (outputs.slenderness_warning) {
    list.append(
      resultRow([{ text: t("result_slenderness") }], [{ text: t("slenderness_flag") }], {
        danger: true,
      })
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_kd") }],
        [{ text: formatNumber(outputs.dynamic_factor, 2) }]
      ),
      resultRow(
        [{ text: t("result_kt") }],
        [{ text: formatNumber(outputs.stress_concentration, 2) }]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-beam__error");
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

async function calculateBeam(panel, button) {
  const root = panel.querySelector(".mechbox-beam");
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
        tool_id: "beam",
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

export async function mountBeamWorkbench(panel) {
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
    "mechbox__workbench-panel--sheet-metal"
  );
  panel.classList.add("mechbox__workbench-panel--beam");

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
  root.className = "mechbox-beam";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-beam__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-beam__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-beam__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-beam__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-beam__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const caseSelect = selectInput(
    "case_id",
    CASES.map((id) => [id, t(`case_${id}`)]),
    "simply_center"
  );
  caseSelect.addEventListener("change", () => syncVisibility(root));

  const sectionSelect = selectInput(
    "section_type",
    SECTIONS.map((id) => [id, t(`section_${id}`)]),
    "solid_round"
  );
  sectionSelect.addEventListener("change", () => syncVisibility(root));

  inputsCard.append(
    fieldRow(document.createTextNode(t("case")), caseSelect, document.createTextNode("")),
    fieldRow(
      document.createTextNode(t("section")),
      sectionSelect,
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("material")),
      selectInput(
        "material_id",
        MATERIALS.map((id) => [id, t(`material_${id.replace(/-/g, "_")}`)]),
        "q235"
      ),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("span")),
      numberInput("span_length_mm", "500"),
      document.createTextNode("mm")
    )
  );

  const loadRow = fieldRow(
    document.createTextNode(t("point_load")),
    numberInput("load_n", "2000"),
    document.createTextNode("N")
  );
  loadRow.dataset.caseShow = "simply_center cantilever_end";
  inputsCard.append(loadRow);

  const lineLoadRow = fieldRow(
    document.createTextNode(t("line_load")),
    numberInput("line_load_n_per_mm", "4"),
    document.createTextNode("N/mm")
  );
  lineLoadRow.dataset.caseShow = "simply_uniform cantilever_uniform";
  inputsCard.append(lineLoadRow);

  const diameterRow = fieldRow(
    document.createTextNode(t("diameter")),
    numberInput("diameter_mm", "30"),
    document.createTextNode("mm")
  );
  diameterRow.dataset.sectionShow = "solid_round hollow_round";
  inputsCard.append(diameterRow);

  const innerRow = fieldRow(
    document.createTextNode(t("inner_diameter")),
    numberInput("inner_diameter_mm", "0"),
    document.createTextNode("mm")
  );
  innerRow.dataset.sectionShow = "hollow_round";
  inputsCard.append(innerRow);

  const widthRow = fieldRow(
    document.createTextNode(t("width")),
    numberInput("width_mm", "20"),
    document.createTextNode("mm")
  );
  widthRow.dataset.sectionShow = "rectangle";
  inputsCard.append(widthRow);

  const heightRow = fieldRow(
    document.createTextNode(t("height")),
    numberInput("height_mm", "30"),
    document.createTextNode("mm")
  );
  heightRow.dataset.sectionShow = "rectangle";
  inputsCard.append(heightRow);

  const eRow = fieldRow(
    document.createTextNode(t("elastic_modulus")),
    numberInput("elastic_modulus_mpa", ""),
    document.createTextNode("MPa")
  );
  eRow.dataset.calcShow = "full professional";
  inputsCard.append(eRow);

  const allowSRow = fieldRow(
    document.createTextNode(t("allowable_stress")),
    numberInput("allowable_stress_mpa", ""),
    document.createTextNode("MPa")
  );
  allowSRow.dataset.calcShow = "full professional";
  inputsCard.append(allowSRow);

  const allowDRow = fieldRow(
    document.createTextNode(t("allowable_deflection")),
    numberInput("allowable_deflection_mm", ""),
    document.createTextNode("mm")
  );
  allowDRow.dataset.calcShow = "full professional";
  inputsCard.append(allowDRow);

  const kdRow = fieldRow(
    document.createTextNode(t("dynamic_factor")),
    numberInput("dynamic_factor", "1.2"),
    document.createTextNode("-")
  );
  kdRow.dataset.calcShow = "professional";
  inputsCard.append(kdRow);

  const ktRow = fieldRow(
    document.createTextNode(t("stress_concentration")),
    numberInput("stress_concentration", "1.5"),
    document.createTextNode("-")
  );
  ktRow.dataset.calcShow = "professional";
  inputsCard.append(ktRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-beam__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateBeam(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-beam__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-beam__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-beam__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
