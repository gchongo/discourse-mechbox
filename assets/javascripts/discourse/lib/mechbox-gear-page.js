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
const MATERIALS = [
  ["st-soft", "st-soft"],
  ["st-hard", "st-hard"],
  ["case-carburized", "case-carburized"],
  ["nitrided", "nitrided"],
  ["gg", "gg"],
  ["ggg", "ggg"],
];

function t(key, options) {
  return i18n(`mechbox.gear.${key}`, options);
}

function materialLabel(id) {
  return t(`material_${id.replace(/-/g, "_")}`);
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
  row.className = "mechbox-gear__field";
  const label = document.createElement("label");
  label.className = "mechbox-gear__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-gear__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-gear__unit";
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
  input.className = "mechbox__inputs mechbox-gear__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-gear__select";
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
  const bar = root.querySelector(".mechbox-gear__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "F_t=2000 T/d",
        "\\sigma_F=F_t/(b m Y)",
        "\\sigma_H\\approx 118\\sqrt{F_t(u+1)/(b d u)}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\sigma_H=Z_B Z_H Z_E Z_{\\varepsilon} Z_{\\beta}\\sqrt{\\ldots}",
        "\\sigma_F=(F_t/(b m_n)) Y_F Y_S K_A K_V\\ldots",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "S_H=\\sigma_{H\\lim}/\\sigma_H",
        "S_F=\\sigma_{F\\lim}/\\sigma_F",
        "\\mathrm{ISO}\\leftrightarrow\\mathrm{AGMA}",
      ],
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
  const inputs = {
    calc_mode: calcMode,
    module_mm: Number(root.querySelector('input[name="module_mm"]')?.value),
    pinion_teeth: Number(root.querySelector('input[name="pinion_teeth"]')?.value),
    gear_teeth: Number(root.querySelector('input[name="gear_teeth"]')?.value),
    face_width_mm: Number(root.querySelector('input[name="face_width_mm"]')?.value),
    torque_nm: Number(root.querySelector('input[name="torque_nm"]')?.value),
    rpm: Number(root.querySelector('input[name="rpm"]')?.value || 0),
    pressure_angle_deg: Number(
      root.querySelector('input[name="pressure_angle_deg"]')?.value || 20
    ),
  };

  if (calcMode === "simple") {
    inputs.material = root.querySelector('select[name="material"]')?.value || "st-soft";
    const formFactor = root.querySelector('input[name="form_factor"]')?.value;
    if (formFactor) {
      inputs.form_factor = Number(formFactor);
    }
    const allowB = root.querySelector('input[name="allow_bending_mpa"]')?.value;
    const allowC = root.querySelector('input[name="allow_contact_mpa"]')?.value;
    if (allowB) {
      inputs.allow_bending_mpa = Number(allowB);
    }
    if (allowC) {
      inputs.allow_contact_mpa = Number(allowC);
    }
  } else {
    inputs.helix_angle_deg = Number(
      root.querySelector('input[name="helix_angle_deg"]')?.value || 0
    );
    inputs.pinion_material =
      root.querySelector('select[name="pinion_material"]')?.value || "st-soft";
    inputs.gear_material =
      root.querySelector('select[name="gear_material"]')?.value || "st-soft";
    inputs.application_factor = Number(
      root.querySelector('input[name="application_factor"]')?.value || 1.25
    );
    inputs.iso1328_grade = Number(
      root.querySelector('input[name="iso1328_grade"]')?.value || 6
    );
    inputs.min_safety_contact = Number(
      root.querySelector('input[name="min_safety_contact"]')?.value || 1.0
    );
    inputs.min_safety_bending = Number(
      root.querySelector('input[name="min_safety_bending"]')?.value || 1.4
    );
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-gear__result-row";
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
  const box = panel.querySelector(".mechbox-gear__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-gear__status ${
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
  list.className = "mechbox-gear__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_force")} ` }, { tex: "F_t" }],
      [{ tex: `${formatNumber(outputs.tangential_force_n, 1)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_bending")} ` }, { tex: "\\sigma_F" }],
      [{ tex: `${formatNumber(outputs.bending_stress_mpa, 1)}\\,\\mathrm{MPa}` }],
      { danger: outputs.bending_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_contact")} ` }, { tex: "\\sigma_H" }],
      [{ tex: `${formatNumber(outputs.contact_stress_mpa, 1)}\\,\\mathrm{MPa}` }],
      { danger: outputs.contact_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_velocity")} ` }, { tex: "v" }],
      [{ text: `${formatNumber(outputs.pitch_line_velocity_mps, 3)} m/s` }]
    )
  );

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: `${t("result_safety_bending")} ` }, { tex: "S_F" }],
        [{ text: formatNumber(outputs.safety_bending, 2) }],
        { danger: outputs.bending_pass === false }
      ),
      resultRow(
        [{ text: `${t("result_safety_contact")} ` }, { tex: "S_H" }],
        [{ text: formatNumber(outputs.safety_contact, 2) }],
        { danger: outputs.contact_pass === false }
      ),
      resultRow(
        [{ text: t("result_contact_ratio") }],
        [{ text: formatNumber(outputs.contact_ratio, 3) }]
      )
    );
  } else {
    list.append(
      resultRow(
        [{ text: t("result_allow_bending") }],
        [{ text: `${formatNumber(outputs.allow_bending_mpa, 1)} MPa` }]
      ),
      resultRow(
        [{ text: t("result_allow_contact") }],
        [{ text: `${formatNumber(outputs.allow_contact_mpa, 1)} MPa` }]
      )
    );
  }

  if (calcMode === "professional" && outputs.agma) {
    list.append(
      resultRow(
        [{ text: t("result_agma_contact") }],
        [
          {
            text: `${formatNumber(outputs.agma.contact_stress_mpa, 1)} MPa / S=${formatNumber(
              outputs.agma.safety_contact,
              2
            )}`,
          },
        ],
        { danger: outputs.agma.contact_pass === false }
      ),
      resultRow(
        [{ text: t("result_agma_bending") }],
        [
          {
            text: `${formatNumber(outputs.agma.bending_stress_mpa, 1)} MPa / S=${formatNumber(
              outputs.agma.safety_bending,
              2
            )}`,
          },
        ],
        { danger: outputs.agma.bending_pass === false }
      )
    );
    if (outputs.compare) {
      list.append(
        resultRow(
          [{ text: t("result_compare") }],
          [
            {
              text: `ΔσH ${formatNumber(outputs.compare.contact_stress_diff_pct, 1)}% · ΔσF ${formatNumber(
                outputs.compare.bending_stress_diff_pct,
                1
              )}%`,
            },
          ]
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-gear__error");
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

async function calculateGear(panel, button) {
  const root = panel.querySelector(".mechbox-gear");
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
        tool_id: "gear",
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

export async function mountGearWorkbench(panel) {
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
    "mechbox__workbench-panel--gear"
  );
  panel.classList.add("mechbox__workbench-panel--gear");

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
  root.className = "mechbox-gear";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-gear__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-gear__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-gear__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-gear__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-gear__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const materialOptions = MATERIALS.map(([id]) => [id, materialLabel(id)]);

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("module")),
      numberInput("module_mm", "2"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("pinion_teeth")),
      numberInput("pinion_teeth", "24"),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("gear_teeth")),
      numberInput("gear_teeth", "72"),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("face_width")),
      numberInput("face_width_mm", "20"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("torque")),
      numberInput("torque_nm", "50"),
      document.createTextNode("N·m")
    ),
    fieldRow(
      document.createTextNode(t("rpm")),
      numberInput("rpm", "1000"),
      document.createTextNode("rpm")
    ),
    fieldRow(
      document.createTextNode(t("pressure_angle")),
      numberInput("pressure_angle_deg", "20"),
      document.createTextNode("°")
    )
  );

  const materialRow = fieldRow(
    document.createTextNode(t("material")),
    selectInput("material", materialOptions, "st-soft"),
    document.createTextNode("")
  );
  materialRow.dataset.calcShow = "simple";
  inputsCard.append(materialRow);

  const formFactorRow = fieldRow(
    document.createTextNode(t("form_factor")),
    numberInput("form_factor", "2.65"),
    document.createTextNode("-")
  );
  formFactorRow.dataset.calcShow = "simple";
  inputsCard.append(formFactorRow);

  const allowBRow = fieldRow(
    document.createTextNode(t("allow_bending")),
    numberInput("allow_bending_mpa", ""),
    document.createTextNode("MPa")
  );
  allowBRow.dataset.calcShow = "simple";
  inputsCard.append(allowBRow);

  const allowCRow = fieldRow(
    document.createTextNode(t("allow_contact")),
    numberInput("allow_contact_mpa", ""),
    document.createTextNode("MPa")
  );
  allowCRow.dataset.calcShow = "simple";
  inputsCard.append(allowCRow);

  const helixRow = fieldRow(
    document.createTextNode(t("helix_angle")),
    numberInput("helix_angle_deg", "0"),
    document.createTextNode("°")
  );
  helixRow.dataset.calcShow = "full professional";
  inputsCard.append(helixRow);

  const pinionMatRow = fieldRow(
    document.createTextNode(t("pinion_material")),
    selectInput("pinion_material", materialOptions, "st-soft"),
    document.createTextNode("")
  );
  pinionMatRow.dataset.calcShow = "full professional";
  inputsCard.append(pinionMatRow);

  const gearMatRow = fieldRow(
    document.createTextNode(t("gear_material")),
    selectInput("gear_material", materialOptions, "st-soft"),
    document.createTextNode("")
  );
  gearMatRow.dataset.calcShow = "full professional";
  inputsCard.append(gearMatRow);

  const kaRow = fieldRow(
    document.createTextNode(t("application_factor")),
    numberInput("application_factor", "1.25"),
    document.createTextNode("-")
  );
  kaRow.dataset.calcShow = "full professional";
  inputsCard.append(kaRow);

  const gradeRow = fieldRow(
    document.createTextNode(t("iso1328_grade")),
    numberInput("iso1328_grade", "6"),
    document.createTextNode("")
  );
  gradeRow.dataset.calcShow = "full professional";
  inputsCard.append(gradeRow);

  const shRow = fieldRow(
    document.createTextNode(t("min_safety_contact")),
    numberInput("min_safety_contact", "1.0"),
    document.createTextNode("-")
  );
  shRow.dataset.calcShow = "full professional";
  inputsCard.append(shRow);

  const sfRow = fieldRow(
    document.createTextNode(t("min_safety_bending")),
    numberInput("min_safety_bending", "1.4"),
    document.createTextNode("-")
  );
  sfRow.dataset.calcShow = "full professional";
  inputsCard.append(sfRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-gear__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateGear(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-gear__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-gear__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-gear__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
