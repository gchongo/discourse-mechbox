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
const ANALYSIS = ["machining", "casting"];
const GRADES = ["coarse", "medium", "fine"];
const OPS = ["rough", "semi", "finish"];
const CAST_MATERIALS = [
  "sand_iron",
  "sand_steel",
  "die_aluminum",
  "sand_aluminum",
  "investment",
];
const SURFACES = ["external", "internal", "deep_core"];
const MODE_OPS = {
  simple: ["rough", "finish"],
  full: ["rough", "semi", "finish"],
  professional: ["rough", "semi", "finish"],
};

function t(key, options) {
  return i18n(`mechbox.manufacturing.${key}`, options);
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
  row.className = "mechbox-manufacturing__field";
  const label = document.createElement("label");
  label.className = "mechbox-manufacturing__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-manufacturing__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-manufacturing__unit";
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
  input.className = "mechbox__inputs mechbox-manufacturing__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-manufacturing__select";
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
  return root.querySelector('select[name="analysis_type"]')?.value || "machining";
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const analysis = getAnalysis(root);

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-analysis-show]").forEach((el) => {
    const types = (el.dataset.analysisShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-analysis-hidden", !types.includes(analysis));
  });

  // Sync operation checkboxes when mode changes
  const opsWrap = root.querySelector(".mechbox-manufacturing__ops");
  if (opsWrap && calcMode !== "simple") {
    const defaults = MODE_OPS[calcMode] || MODE_OPS.full;
    opsWrap.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (!root._opsTouched) {
        cb.checked = defaults.includes(cb.value);
      }
    });
  }
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
  const bar = root.querySelector(".mechbox-manufacturing__formula-bar");
  if (!bar) {
    return;
  }

  const analysis = getAnalysis(root);
  if (analysis === "machining") {
    fillFormulaBar(bar, {
      title: t("formula_machining"),
      hint: t("hint_machining"),
      formulas: [
        "D_{\\mathrm{stock}}=d+2\\sum a_i",
        "L_{\\mathrm{stock}}=L+2a_{\\mathrm{end}}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_casting"),
      hint: t("hint_casting"),
      formulas: [
        "\\alpha=(a_0+c\\sqrt{h})\\,f_{\\mathrm{surf}}",
        "\\Delta w=2 h\\tan\\alpha",
      ],
    });
  }
  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  root._opsTouched = false;
  setCalcMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function collectOperations(root) {
  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    return MODE_OPS.simple;
  }
  const checked = [
    ...root.querySelectorAll('.mechbox-manufacturing__ops input[type="checkbox"]:checked'),
  ].map((el) => el.value);
  return checked.length ? checked : MODE_OPS[calcMode] || MODE_OPS.full;
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const analysis = getAnalysis(root);
  const inputs = { calc_mode: calcMode, analysis_type: analysis };

  if (analysis === "machining") {
    inputs.nominal_diameter_mm = Number(
      root.querySelector('input[name="nominal_diameter_mm"]')?.value
    );
    inputs.length_mm = Number(root.querySelector('input[name="length_mm"]')?.value);
    inputs.tolerance_grade =
      root.querySelector('select[name="tolerance_grade"]')?.value || "medium";
    inputs.operations_json = JSON.stringify(collectOperations(root));
    if (calcMode === "professional") {
      inputs.removal_rate_mm3_min = Number(
        root.querySelector('input[name="removal_rate_mm3_min"]')?.value || 50
      );
    }
  } else {
    inputs.cast_material =
      root.querySelector('select[name="cast_material"]')?.value || "sand_iron";
    inputs.surface_type =
      root.querySelector('select[name="surface_type"]')?.value || "external";
    inputs.depth_mm = Number(root.querySelector('input[name="depth_mm"]')?.value);
    inputs.rough_surface = root.querySelector('input[name="rough_surface"]')?.checked
      ? "true"
      : "false";
    if (calcMode !== "simple") {
      inputs.imperfection_factor = Number(
        root.querySelector('input[name="imperfection_factor"]')?.value || 1.05
      );
    }
    const actual = root.querySelector('input[name="actual_draft_angle_deg"]')?.value;
    if (actual !== "" && actual != null) {
      inputs.actual_draft_angle_deg = Number(actual);
    }
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-manufacturing__result-row";
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

function renderDetails(details) {
  const wrap = document.createElement("div");
  wrap.className = "mechbox-manufacturing__miner";
  const title = document.createElement("h4");
  title.textContent = t("details_title");
  wrap.append(title);
  const table = document.createElement("table");
  table.className = "mechbox-manufacturing__curve-table";
  table.innerHTML = `<thead><tr><th>${t("details_op")}</th><th>${t(
    "details_allowance"
  )}</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  (details || []).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t(`op_${row.operation}`)}</td><td>${formatNumber(
      row.radial_allowance_mm,
      2
    )}</td>`;
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-manufacturing__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const analysis = outputs.analysis_type || "machining";
  box.replaceChildren();
  box.classList.add("is-visible");

  const hasPass = typeof outputs.pass === "boolean";
  const status = document.createElement("div");
  status.className = `mechbox-manufacturing__status ${
    hasPass ? (outputs.pass ? "is-pass" : "is-attention") : "is-pass"
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
  list.className = "mechbox-manufacturing__result-list";

  if (analysis === "machining") {
    list.append(
      resultRow(
        [{ text: t("result_radial") }],
        [{ text: `${formatNumber(outputs.total_radial_allowance_mm, 2)} mm` }]
      ),
      resultRow(
        [{ text: t("result_stock_d") }],
        [{ text: `${formatNumber(outputs.recommended_stock_diameter_mm, 1)} mm` }]
      ),
      resultRow(
        [{ text: t("result_stock_l") }],
        [{ text: `${formatNumber(outputs.recommended_stock_length_mm, 1)} mm` }]
      ),
      resultRow(
        [{ text: t("result_end") }],
        [{ text: `${formatNumber(outputs.end_face_allowance_mm, 1)} mm` }]
      ),
      resultRow(
        [{ text: t("result_volume") }],
        [
          {
            text: `${formatNumber(outputs.material_removal_volume_mm3 / 1000, 1)} cm³`,
          },
        ]
      )
    );
    if (outputs.grinding_allowance_mm != null) {
      list.append(
        resultRow(
          [{ text: t("result_grind") }],
          [{ text: `${formatNumber(outputs.grinding_allowance_mm, 2)} mm` }]
        ),
        resultRow(
          [{ text: t("result_min_stock") }],
          [{ text: `${formatNumber(outputs.min_stock_diameter_mm, 1)} mm` }]
        )
      );
    }
    if (outputs.estimated_machining_minutes != null) {
      list.append(
        resultRow(
          [{ text: t("result_time") }],
          [{ text: `${formatNumber(outputs.estimated_machining_minutes, 0)} min` }]
        )
      );
    }
    box.append(list);
    if (outputs.details?.length) {
      box.append(renderDetails(outputs.details));
    }
  } else {
    list.append(
      resultRow(
        [{ text: t("result_draft") }],
        [{ text: `${formatNumber(outputs.draft_angle_deg, 2)} °` }]
      ),
      resultRow(
        [{ text: t("result_linear") }],
        [{ text: `${formatNumber(outputs.linear_increase_per_side_mm, 2)} mm` }]
      ),
      resultRow(
        [{ text: t("result_width") }],
        [{ text: `${formatNumber(outputs.total_width_increase_mm, 2)} mm` }]
      )
    );
    if (outputs.actual_draft_angle_deg != null) {
      list.append(
        resultRow(
          [{ text: t("result_verify") }],
          [
            {
              text: `${formatNumber(outputs.actual_draft_angle_deg, 2)} ° — ${
                outputs.verify_pass ? t("verify_ok") : t("verify_bad")
              }`,
            },
          ],
          { danger: outputs.verify_pass === false }
        )
      );
    }
    const note = document.createElement("p");
    note.className = "mechbox-manufacturing__hint";
    note.textContent = t(
      outputs.note_key === "high_draft" ? "note_high_draft" : "note_normal"
    );
    box.append(list, note);
  }

  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-manufacturing__error");
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

async function calculateManufacturing(panel, button) {
  const root = panel.querySelector(".mechbox-manufacturing");
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
        tool_id: "manufacturing",
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

export async function mountManufacturingWorkbench(panel) {
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
    "mechbox__workbench-panel--structural",
    "mechbox__workbench-panel--manufacturing"
  );
  panel.classList.add("mechbox__workbench-panel--manufacturing");

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
  root.className = "mechbox-manufacturing";
  setCalcMode(root, "simple");
  root._opsTouched = false;

  const modes = document.createElement("div");
  modes.className = "mechbox-manufacturing__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-manufacturing__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-manufacturing__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-manufacturing__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-manufacturing__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const analysisSelect = selectInput(
    "analysis_type",
    ANALYSIS.map((id) => [id, t(`analysis_${id}`)]),
    "machining"
  );
  analysisSelect.addEventListener("change", () => {
    syncVisibility(root);
    updateFormulaBar(root);
  });
  inputsCard.append(
    fieldRow(document.createTextNode(t("analysis")), analysisSelect, document.createTextNode(""))
  );

  // Machining
  [
    ["nominal_diameter_mm", "nominal_diameter", "50", "mm"],
    ["length_mm", "length", "120", "mm"],
  ].forEach(([name, labelKey, value, unit]) => {
    const row = fieldRow(
      document.createTextNode(t(labelKey)),
      numberInput(name, value),
      document.createTextNode(unit)
    );
    row.dataset.analysisShow = "machining";
    inputsCard.append(row);
  });

  const gradeRow = fieldRow(
    document.createTextNode(t("tolerance_grade")),
    selectInput(
      "tolerance_grade",
      GRADES.map((id) => [id, t(`grade_${id}`)]),
      "medium"
    ),
    document.createTextNode("")
  );
  gradeRow.dataset.analysisShow = "machining";
  inputsCard.append(gradeRow);

  const opsWrap = document.createElement("div");
  opsWrap.className = "mechbox-manufacturing__ops mechbox-manufacturing__radios";
  OPS.forEach((op) => {
    const label = document.createElement("label");
    label.className = "mechbox-manufacturing__check-label";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "mechbox-manufacturing__checkbox";
    cb.value = op;
    cb.checked = MODE_OPS.full.includes(op);
    cb.addEventListener("change", () => {
      root._opsTouched = true;
    });
    label.append(cb, document.createTextNode(` ${t(`op_${op}`)}`));
    opsWrap.append(label);
  });
  const opsRow = fieldRow(
    document.createTextNode(t("operations")),
    opsWrap,
    document.createTextNode("")
  );
  opsRow.dataset.analysisShow = "machining";
  opsRow.dataset.calcShow = "full professional";
  inputsCard.append(opsRow);

  const simpleOpsHint = document.createElement("p");
  simpleOpsHint.className = "mechbox-manufacturing__hint";
  simpleOpsHint.dataset.analysisShow = "machining";
  simpleOpsHint.dataset.calcShow = "simple";
  simpleOpsHint.textContent = t("operations_fixed");
  inputsCard.append(simpleOpsHint);

  const rateRow = fieldRow(
    document.createTextNode(t("removal_rate")),
    numberInput("removal_rate_mm3_min", "50"),
    document.createTextNode("mm³/min")
  );
  rateRow.dataset.analysisShow = "machining";
  rateRow.dataset.calcShow = "professional";
  inputsCard.append(rateRow);

  // Casting
  const castMatRow = fieldRow(
    document.createTextNode(t("cast_material")),
    selectInput(
      "cast_material",
      CAST_MATERIALS.map((id) => [id, t(`cast_${id}`)]),
      "sand_iron"
    ),
    document.createTextNode("")
  );
  castMatRow.dataset.analysisShow = "casting";
  inputsCard.append(castMatRow);

  const surfRow = fieldRow(
    document.createTextNode(t("surface_type")),
    selectInput(
      "surface_type",
      SURFACES.map((id) => [id, t(`surface_${id}`)]),
      "external"
    ),
    document.createTextNode("")
  );
  surfRow.dataset.analysisShow = "casting";
  inputsCard.append(surfRow);

  const depthRow = fieldRow(
    document.createTextNode(t("depth")),
    numberInput("depth_mm", "80"),
    document.createTextNode("mm")
  );
  depthRow.dataset.analysisShow = "casting";
  inputsCard.append(depthRow);

  const roughCheck = document.createElement("input");
  roughCheck.type = "checkbox";
  roughCheck.name = "rough_surface";
  roughCheck.className = "mechbox-manufacturing__checkbox";
  const roughLabel = document.createElement("label");
  roughLabel.className = "mechbox-manufacturing__check-label";
  roughLabel.append(roughCheck, document.createTextNode(` ${t("rough_surface")}`));
  const roughRow = fieldRow(
    document.createTextNode(t("surface_finish")),
    roughLabel,
    document.createTextNode("")
  );
  roughRow.dataset.analysisShow = "casting";
  inputsCard.append(roughRow);

  const imperfRow = fieldRow(
    document.createTextNode(t("imperfection")),
    numberInput("imperfection_factor", "1.05"),
    document.createTextNode("-")
  );
  imperfRow.dataset.analysisShow = "casting";
  imperfRow.dataset.calcShow = "full professional";
  inputsCard.append(imperfRow);

  const actualRow = fieldRow(
    document.createTextNode(t("actual_draft")),
    numberInput("actual_draft_angle_deg", ""),
    document.createTextNode("°")
  );
  actualRow.dataset.analysisShow = "casting";
  inputsCard.append(actualRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-manufacturing__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateManufacturing(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-manufacturing__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-manufacturing__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-manufacturing__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
