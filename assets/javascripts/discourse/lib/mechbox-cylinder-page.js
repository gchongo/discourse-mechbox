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
const TYPES = ["hydraulic", "pneumatic"];
const END_FIXITY = [
  "fixed_fixed",
  "fixed_pinned",
  "pinned_pinned",
  "fixed_free",
];

function t(key, options) {
  return i18n(`mechbox.cylinder.${key}`, options);
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
  row.className = "mechbox-cylinder__field";
  const label = document.createElement("label");
  label.className = "mechbox-cylinder__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-cylinder__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-cylinder__unit";
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
  input.className = "mechbox__inputs mechbox-cylinder__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-cylinder__select";
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

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const type = root.querySelector('select[name="cylinder_type"]')?.value || "hydraulic";

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-type-show]").forEach((el) => {
    const types = (el.dataset.typeShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-type-hidden", !types.includes(type));
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
  const bar = root.querySelector(".mechbox-cylinder__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["F=p A", "v=Q\\times 10^{6}/(60 A)"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["F_{cr}=\\pi^{2} E I/(K L)^{2}", "L_e=K L"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["F_{dyn}=m g+m a", "t=L/v"],
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
  const type = root.querySelector('select[name="cylinder_type"]')?.value || "hydraulic";
  const inputs = {
    calc_mode: calcMode,
    cylinder_type: type,
    bore_diameter_mm: Number(root.querySelector('input[name="bore_diameter_mm"]')?.value),
    rod_diameter_mm: Number(root.querySelector('input[name="rod_diameter_mm"]')?.value),
    pressure_mpa: Number(root.querySelector('input[name="pressure_mpa"]')?.value),
    flow_rate_lpm: Number(root.querySelector('input[name="flow_rate_lpm"]')?.value),
  };

  if (type === "pneumatic") {
    inputs.efficiency = Number(root.querySelector('input[name="efficiency"]')?.value || 0.85);
  }

  if (calcMode !== "simple") {
    inputs.external_load_n = Number(
      root.querySelector('input[name="external_load_n"]')?.value || 0
    );
    inputs.stroke_length_mm = Number(
      root.querySelector('input[name="stroke_length_mm"]')?.value || 0
    );
    inputs.yield_strength_mpa = Number(
      root.querySelector('input[name="yield_strength_mpa"]')?.value || 235
    );
    inputs.end_fixity =
      root.querySelector('select[name="end_fixity"]')?.value || "pinned_pinned";
    inputs.compress_on_retract = root.querySelector(
      'input[name="compress_on_retract"]'
    )?.checked
      ? "true"
      : "false";
  }

  if (calcMode === "professional") {
    inputs.load_mass_kg = Number(root.querySelector('input[name="load_mass_kg"]')?.value || 0);
    inputs.acceleration_m_s2 = Number(
      root.querySelector('input[name="acceleration_m_s2"]')?.value || 0
    );
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-cylinder__result-row";
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
  const box = panel.querySelector(".mechbox-cylinder__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-cylinder__status ${
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
  list.className = "mechbox-cylinder__result-list";

  list.append(
    resultRow(
      [{ text: t("result_extend_force") }],
      [{ tex: `${formatNumber(outputs.extend_force_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: t("result_retract_force") }],
      [{ tex: `${formatNumber(outputs.retract_force_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: t("result_extend_vel") }],
      [{ tex: `${formatNumber(outputs.extend_velocity_mm_s, 1)}\\,\\mathrm{mm/s}` }]
    ),
    resultRow(
      [{ text: t("result_retract_vel") }],
      [{ tex: `${formatNumber(outputs.retract_velocity_mm_s, 1)}\\,\\mathrm{mm/s}` }]
    ),
    resultRow(
      [{ text: t("result_bore_area") }],
      [{ tex: `${formatNumber(outputs.bore_area_mm2, 1)}\\,\\mathrm{mm^{2}}` }]
    )
  );

  if (outputs.efficiency != null) {
    list.append(
      resultRow([{ text: t("result_efficiency") }], [{ text: formatNumber(outputs.efficiency, 2) }])
    );
  }

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: t("result_load_margin") }],
        [
          {
            text: `${formatNumber(outputs.extend_margin_n, 0)} / ${formatNumber(
              outputs.retract_margin_n,
              0
            )} N`,
          },
        ],
        { danger: outputs.load_pass === false }
      )
    );

    if (outputs.buckling_load_n != null) {
      const skip = outputs.buckling?.check_skipped;
      list.append(
        resultRow(
          [{ text: t("result_buckling") }],
          [
            {
              text: skip
                ? `${formatNumber(outputs.buckling_load_n, 0)} N — ${t("buckling_skipped")}`
                : `${formatNumber(outputs.buckling_load_n, 0)} N`,
            },
          ],
          { danger: outputs.buckling_pass === false }
        )
      );
    }
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_dynamic") }],
        [{ text: `${formatNumber(outputs.dynamic_load_n, 0)} N` }],
        { danger: outputs.dynamic_load_pass === false }
      ),
      resultRow(
        [{ text: t("result_cycle") }],
        [
          {
            text: `${formatNumber(outputs.cycle_time_extend_s, 2)} / ${formatNumber(
              outputs.cycle_time_retract_s,
              2
            )} s`,
          },
        ]
      ),
      resultRow(
        [{ text: t("result_cushion") }],
        [{ text: `${formatNumber(outputs.cushion_force_n, 0)} N` }]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-cylinder__error");
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

async function calculateCylinder(panel, button) {
  const root = panel.querySelector(".mechbox-cylinder");
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
        tool_id: "cylinder",
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

export async function mountCylinderWorkbench(panel) {
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
    "mechbox__workbench-panel--cylinder"
  );
  panel.classList.add("mechbox__workbench-panel--cylinder");

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
  root.className = "mechbox-cylinder";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-cylinder__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-cylinder__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-cylinder__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-cylinder__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-cylinder__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const typeSelect = selectInput(
    "cylinder_type",
    TYPES.map((id) => [id, t(`type_${id}`)]),
    "hydraulic"
  );
  typeSelect.addEventListener("change", () => {
    syncVisibility(root);
    updateFormulaBar(root);
  });

  inputsCard.append(
    fieldRow(document.createTextNode(t("type")), typeSelect, document.createTextNode("")),
    fieldRow(
      document.createTextNode(t("bore")),
      numberInput("bore_diameter_mm", "50"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("rod")),
      numberInput("rod_diameter_mm", "20"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("pressure")),
      numberInput("pressure_mpa", "16"),
      document.createTextNode("MPa")
    ),
    fieldRow(
      document.createTextNode(t("flow")),
      numberInput("flow_rate_lpm", "20"),
      document.createTextNode("L/min")
    )
  );

  const effRow = fieldRow(
    document.createTextNode(t("efficiency")),
    numberInput("efficiency", "0.85"),
    document.createTextNode("-")
  );
  effRow.dataset.typeShow = "pneumatic";
  inputsCard.append(effRow);

  const loadRow = fieldRow(
    document.createTextNode(t("external_load")),
    numberInput("external_load_n", "8000"),
    document.createTextNode("N")
  );
  loadRow.dataset.calcShow = "full professional";
  inputsCard.append(loadRow);

  const strokeRow = fieldRow(
    document.createTextNode(t("stroke")),
    numberInput("stroke_length_mm", "300"),
    document.createTextNode("mm")
  );
  strokeRow.dataset.calcShow = "full professional";
  inputsCard.append(strokeRow);

  const fyRow = fieldRow(
    document.createTextNode(t("yield_strength")),
    numberInput("yield_strength_mpa", "235"),
    document.createTextNode("MPa")
  );
  fyRow.dataset.calcShow = "full professional";
  inputsCard.append(fyRow);

  const fixityRow = fieldRow(
    document.createTextNode(t("end_fixity")),
    selectInput(
      "end_fixity",
      END_FIXITY.map((id) => [id, t(`fixity_${id}`)]),
      "pinned_pinned"
    ),
    document.createTextNode("")
  );
  fixityRow.dataset.calcShow = "full professional";
  inputsCard.append(fixityRow);

  const compressCheck = document.createElement("input");
  compressCheck.type = "checkbox";
  compressCheck.name = "compress_on_retract";
  compressCheck.checked = true;
  compressCheck.className = "mechbox-cylinder__checkbox";
  const compressLabel = document.createElement("label");
  compressLabel.className = "mechbox-cylinder__check-label";
  compressLabel.append(compressCheck, document.createTextNode(` ${t("compress_on_retract")}`));
  const compressRow = fieldRow(
    document.createTextNode(t("rod_compression")),
    compressLabel,
    document.createTextNode("")
  );
  compressRow.dataset.calcShow = "full professional";
  inputsCard.append(compressRow);

  const massRow = fieldRow(
    document.createTextNode(t("load_mass")),
    numberInput("load_mass_kg", "500"),
    document.createTextNode("kg")
  );
  massRow.dataset.calcShow = "professional";
  inputsCard.append(massRow);

  const accRow = fieldRow(
    document.createTextNode(t("acceleration")),
    numberInput("acceleration_m_s2", "0.5"),
    document.createTextNode("m/s²")
  );
  accRow.dataset.calcShow = "professional";
  inputsCard.append(accRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-cylinder__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateCylinder(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-cylinder__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-cylinder__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-cylinder__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
