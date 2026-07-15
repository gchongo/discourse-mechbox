import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  fillFormulaBar,
  mixedLabel,
  texNode,
  typesetRoot,
} from "./mechbox-tex";

const METRIC_THREAD_PITCH = {
  3: 0.5,
  4: 0.7,
  5: 0.8,
  6: 1.0,
  8: 1.25,
  10: 1.5,
  12: 1.75,
  14: 2.0,
  16: 2.0,
  18: 2.5,
  20: 2.5,
  22: 2.5,
  24: 3.0,
  27: 3.0,
  30: 3.5,
};

const BOLT_GRADES = ["4.6", "4.8", "5.6", "8.8", "10.9", "12.9"];

const EMBEDMENT_PRESETS = {
  steel_standard: 11,
  steel_fine: 7,
  aluminum: 15,
};

const CALC_MODES = ["simple", "full", "professional"];

function t(key, options) {
  return i18n(`mechbox.bolt.${key}`, options);
}

function suggestedPitch(diameter) {
  return METRIC_THREAD_PITCH[Math.round(Number(diameter))] || 1.5;
}

function parseDiameter(root) {
  return Number(root.querySelector('input[name="nominal_diameter_mm"]')?.value) || 10;
}

function defaultDKm(d) {
  return Number((1.45 * d).toFixed(2));
}

function defaultGrip(d) {
  return Number((2 * d).toFixed(1));
}

function defaultHole(d) {
  return Number((d + 1).toFixed(1));
}

function defaultHead(d) {
  return Number((1.5 * d).toFixed(1));
}

function defaultOuter(d, grip, head) {
  const g = grip ?? defaultGrip(d);
  const h = head ?? defaultHead(d);
  return Number((h + 1.4 * g).toFixed(1));
}

function fieldRow(labelEl, control, hintEl) {
  const row = document.createElement("div");
  row.className = "mechbox-bolt__field";

  const label = document.createElement("label");
  label.className = "mechbox-bolt__label";
  label.append(labelEl);

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-bolt__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-bolt__unit";
  if (hintEl) {
    unit.append(hintEl);
  }

  row.append(label, controlWrap, unit);
  return row;
}

function numberInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "mechbox__inputs mechbox-bolt__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function markUserEdited(input) {
  input.addEventListener("input", () => {
    input.dataset.userEdited = "true";
  });
}

function boltDiagramSvg() {
  const wrap = document.createElement("div");
  wrap.className = "mechbox-bolt__diagram";
  wrap.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 280 160");
  svg.classList.add("mechbox-bolt__svg");
  svg.innerHTML = `
    <rect x="110" y="20" width="60" height="18" rx="2" fill="currentColor" opacity="0.35"/>
    <rect x="122" y="38" width="36" height="90" rx="2" fill="currentColor" opacity="0.25"/>
    <path d="M122 98 h36 M122 104 h36 M122 110 h36 M122 116 h36" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
    <path d="M100 48 a20 12 0 0 0 0 24" fill="none" stroke="var(--tertiary)" stroke-width="2"/>
    <path d="M140 130 v20" stroke="var(--tertiary)" stroke-width="2" marker-end="url(#mechbox-bolt-arrow)"/>
    <defs>
      <marker id="mechbox-bolt-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="var(--tertiary)"/>
      </marker>
    </defs>
    <line x1="164" y1="50" x2="164" y2="120" stroke="currentColor" stroke-dasharray="3 2" opacity="0.5"/>
  `;

  const labelT = document.createElement("div");
  labelT.className = "mechbox-bolt__diagram-symbol mechbox-bolt__diagram-symbol--t";
  labelT.append(texNode("T"));

  const labelF = document.createElement("div");
  labelF.className = "mechbox-bolt__diagram-symbol mechbox-bolt__diagram-symbol--f";
  labelF.append(texNode("F"));

  const labelD = document.createElement("div");
  labelD.className = "mechbox-bolt__diagram-symbol mechbox-bolt__diagram-symbol--d";
  labelD.append(texNode("d"));

  const stage = document.createElement("div");
  stage.className = "mechbox-bolt__diagram-stage";
  stage.append(svg, labelT, labelF, labelD);

  const caption = document.createElement("p");
  caption.className = "mechbox-bolt__diagram-caption";
  caption.textContent = t("diagram_caption");

  wrap.append(stage, caption);
  return wrap;
}

function getCalcMode(root) {
  return root.dataset.calcMode || "simple";
}

function setCalcMode(root, mode) {
  root.dataset.calcMode = mode;
}

function syncBoltModeFields(root) {
  const mode =
    root.querySelector('input[name="mode"]:checked')?.value || "torque2force";
  const torqueField = root.querySelector('[data-field="torque_nm"]');
  const preloadField = root.querySelector('[data-field="preload_n"]');

  if (torqueField) {
    torqueField.classList.toggle("is-mode-hidden", mode !== "torque2force");
  }
  if (preloadField) {
    preloadField.classList.toggle("is-mode-hidden", mode !== "force2torque");
  }
}

function syncCalcModeVisibility(root) {
  const calcMode = getCalcMode(root);

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  const embedmentSelect = root.querySelector('select[name="embedment_preset"]');
  const customRow = root.querySelector('[data-field="embedment_um"]');
  if (customRow && embedmentSelect) {
    const showCustom =
      calcMode === "professional" && embedmentSelect.value === "custom";
    customRow.classList.toggle("is-mode-hidden", !showCustom);
  }
}

function syncDiameterHints(root) {
  const diameter = parseDiameter(root);
  const pitch = root.querySelector('input[name="pitch_mm"]');
  const hint = root.querySelector("[data-diameter-hint]");
  const dKm = root.querySelector('input[name="d_km"]');
  const grip = root.querySelector('input[name="grip_length"]');
  const hole = root.querySelector('input[name="hole_diameter"]');
  const head = root.querySelector('input[name="head_contact_diameter"]');
  const outer = root.querySelector('input[name="outer_diameter"]');

  if (hint) {
    hint.replaceChildren();
    hint.append(texNode(`\\mathrm{M}${diameter}`));
    typesetRoot(hint);
  }

  if (pitch && !pitch.dataset.userEdited) {
    pitch.value = String(suggestedPitch(diameter));
  }

  if (dKm && !dKm.dataset.userEdited) {
    dKm.value = String(defaultDKm(diameter));
  }

  if (grip && !grip.dataset.userEdited) {
    grip.value = String(defaultGrip(diameter));
  }

  if (hole && !hole.dataset.userEdited) {
    hole.value = String(defaultHole(diameter));
  }

  if (head && !head.dataset.userEdited) {
    head.value = String(defaultHead(diameter));
  }

  const gripValue = Number(grip?.value) || defaultGrip(diameter);
  const headValue = Number(head?.value) || defaultHead(diameter);

  if (outer && !outer.dataset.userEdited) {
    outer.value = String(defaultOuter(diameter, gripValue, headValue));
  }
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-bolt__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "T = K \\cdot F \\cdot d",
        "F = \\dfrac{T}{K \\cdot d}",
        "\\sigma = \\dfrac{F}{A_{s}}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_vdi"),
      hint: t("estimate_warning_full"),
      formulas: [
        "M_{A} = F\\left(0.16P + 0.58 d_{2}\\mu_{G} + \\dfrac{D_{km}}{2}\\mu_{K}\\right)",
        "\\sigma = \\dfrac{F}{A_{s}}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_stiffness"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "F_{V} = F_{M} + F_{Z} - \\Delta F_{VT}",
        "F_{Z} = \\dfrac{f_{Z}}{\\delta_{S}+\\delta_{P}}",
        "\\Phi = \\dfrac{k_{S}}{k_{S}+k_{P}}",
        "\\sigma = \\dfrac{F_{V}}{A_{s}}",
      ],
    });
  }

  typesetRoot(bar);
}

function syncModeTabs(root) {
  const calcMode = getCalcMode(root);
  root.querySelectorAll("[data-calc-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.calcMode === calcMode);
  });
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
  syncCalcModeVisibility(root);
  syncBoltModeFields(root);
  updateFormulaBar(root);
}

function collectBoltInputs(root) {
  const calcMode = getCalcMode(root);
  const mode =
    root.querySelector('input[name="mode"]:checked')?.value || "torque2force";
  const inputs = {
    calc_mode: calcMode,
    mode,
    grade: root.querySelector('select[name="grade"]')?.value || "8.8",
    nominal_diameter_mm: Number(
      root.querySelector('input[name="nominal_diameter_mm"]')?.value
    ),
    pitch_mm: Number(root.querySelector('input[name="pitch_mm"]')?.value),
  };

  if (mode === "torque2force") {
    inputs.torque_nm = Number(
      root.querySelector('input[name="torque_nm"]')?.value
    );
  } else {
    inputs.preload_n = Number(
      root.querySelector('input[name="preload_n"]')?.value
    );
  }

  if (calcMode === "simple") {
    inputs.nut_factor = Number(
      root.querySelector('input[name="nut_factor"]')?.value
    );
  } else {
    inputs.mu_g = Number(root.querySelector('input[name="mu_g"]')?.value);
    inputs.mu_k = Number(root.querySelector('input[name="mu_k"]')?.value);
    inputs.d_km = Number(root.querySelector('input[name="d_km"]')?.value);
  }

  if (calcMode === "professional") {
    inputs.grip_length = Number(
      root.querySelector('input[name="grip_length"]')?.value
    );
    inputs.hole_diameter = Number(
      root.querySelector('input[name="hole_diameter"]')?.value
    );
    inputs.head_contact_diameter = Number(
      root.querySelector('input[name="head_contact_diameter"]')?.value
    );
    inputs.outer_diameter = Number(
      root.querySelector('input[name="outer_diameter"]')?.value
    );
    inputs.delta_t = Number(root.querySelector('input[name="delta_t"]')?.value);
    inputs.external_axial_load = Number(
      root.querySelector('input[name="external_axial_load"]')?.value
    );

    const preset =
      root.querySelector('select[name="embedment_preset"]')?.value ||
      "steel_standard";
    inputs.embedment_preset = preset;
    if (preset === "custom") {
      inputs.embedment_um = Number(
        root.querySelector('input[name="embedment_um"]')?.value
      );
    }
  }

  return inputs;
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }

  return Number(num.toFixed(digits)).toString();
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-bolt__result-row";
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

function appendCommonResults(list, outputs) {
  list.append(
    resultRow(
      [{ text: `${t("stress_area")} ` }, { tex: "A_{s}" }],
      [{ tex: `${formatNumber(outputs.stress_area_mm2)}\\,\\mathrm{mm}^{2}` }]
    ),
    resultRow(
      [{ text: `${t("preload")} ` }, { tex: "F" }],
      [
        {
          tex: `${formatNumber(outputs.preload_n, 1)}\\,\\mathrm{N}\\;(${formatNumber(outputs.preload_kn)}\\,\\mathrm{kN})`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("torque")} ` }, { tex: "T" }],
      [{ tex: `${formatNumber(outputs.torque_nm)}\\,\\mathrm{N\\cdot m}` }]
    ),
    resultRow(
      [{ text: `${t("stress")} ` }, { tex: "\\sigma" }],
      [{ tex: `${formatNumber(outputs.stress_mpa)}\\,\\mathrm{MPa}` }],
      { danger: !outputs.pass }
    ),
    resultRow(
      [{ text: t("allow_stress") }],
      [{ tex: `${formatNumber(outputs.allow_stress_mpa, 0)}\\,\\mathrm{MPa}` }]
    ),
    resultRow(
      [{ text: t("max_preload") }],
      [{ tex: `${formatNumber(outputs.max_preload_n, 0)}\\,\\mathrm{N}` }]
    )
  );
}

function appendFullResults(list, outputs) {
  list.append(
    resultRow(
      [{ text: `${t("pitch_diameter")} ` }, { tex: "d_{2}" }],
      [
        {
          tex: `${formatNumber(outputs.pitch_diameter_mm, 3)}\\,\\mathrm{mm}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("torque_thread")} ` }, { tex: "M_{G}" }],
      [
        {
          tex: `${formatNumber(outputs.torque_thread_nm, 3)}\\,\\mathrm{N\\cdot m}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("torque_head")} ` }, { tex: "M_{K}" }],
      [
        {
          tex: `${formatNumber(outputs.torque_head_nm, 3)}\\,\\mathrm{N\\cdot m}`,
        },
      ]
    ),
    resultRow(
      [{ text: t("compare_simple") }],
      [
        {
          tex: `${formatNumber(outputs.compare_torque_nm)}\\,\\mathrm{N\\cdot m}`,
        },
      ]
    )
  );
}

function appendProfessionalResults(list, outputs) {
  list.append(
    resultRow(
      [{ text: `${t("preload_tightening")} ` }, { tex: "F_{V}" }],
      [
        {
          tex: `${formatNumber(outputs.preload_tightening_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("preload_residual")} ` }, { tex: "F_{M}" }],
      [
        {
          tex: `${formatNumber(outputs.preload_residual_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("embedment_loss")} ` }, { tex: "F_{Z}" }],
      [
        {
          tex: `${formatNumber(outputs.embedment_loss_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("thermal_delta")} ` }, { tex: "\\Delta F_{VT}" }],
      [
        {
          tex: `${formatNumber(outputs.thermal_delta_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("load_factor")} ` }, { tex: "\\Phi" }],
      [{ tex: `${formatNumber(Number(outputs.load_factor) * 100, 1)}\\%` }]
    ),
    resultRow(
      [{ text: t("clamp_remaining") }],
      [
        {
          tex: `${formatNumber(outputs.clamping_force_remaining, 0)}\\,\\mathrm{N}`,
        },
      ],
      { danger: outputs.separation_pass === false }
    ),
    resultRow(
      [{ text: `${t("max_bolt_force")} ` }, { tex: "F_{S\\max}" }],
      [
        {
          tex: `${formatNumber(outputs.max_bolt_force, 0)}\\,\\mathrm{N}`,
        },
      ]
    ),
    resultRow(
      [{ text: t("separation_pass") }],
      [
        {
          text: outputs.separation_pass
            ? t("separation_ok")
            : t("separation_fail"),
        },
      ],
      { danger: !outputs.separation_pass }
    )
  );
}


async function renderBoltResults(panel, payload) {
  const box = panel.querySelector(".mechbox-bolt__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || payload || {};
  const calcMode = outputs.calc_mode || getCalcMode(panel.querySelector(".mechbox-bolt"));
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-bolt__status ${outputs.pass ? "is-pass" : "is-attention"}`;
  status.textContent = `${t("overall")}: ${
    outputs.pass ? t("status_pass") : t("status_attention")
  }`;
  box.append(status);

  const list = document.createElement("dl");
  list.className = "mechbox-bolt__result-list";

  appendCommonResults(list, outputs);

  if (calcMode === "full" || calcMode === "professional") {
    appendFullResults(list, outputs);
  }

  if (calcMode === "professional") {
    appendProfessionalResults(list, outputs);
  }

  box.append(list);

  await typesetRoot(box);
}

function setBoltError(panel, message) {
  const error = panel.querySelector(".mechbox-bolt__error");
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

async function calculateBolt(panel, button) {
  const root = panel.querySelector(".mechbox-bolt");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setBoltError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "bolt_clamp_load",
        save_record: false,
        inputs: collectBoltInputs(root),
      },
    });
    await renderBoltResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setBoltError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function radioModeLabel(value) {
  if (value === "torque2force") {
    return mixedLabel([
      { text: `${t("mode_known")} ` },
      { tex: "T" },
      { text: " → " },
      { tex: "F" },
    ]);
  }

  return mixedLabel([
    { text: `${t("mode_known")} ` },
    { tex: "F" },
    { text: " → " },
    { tex: "T" },
  ]);
}

function sectionTitle(text) {
  const el = document.createElement("div");
  el.className = "mechbox-bolt__section-title";
  el.textContent = text;
  return el;
}

function modeTabLabel(mode) {
  if (mode === "simple") {
    return t("model_simple");
  }
  if (mode === "full") {
    return t("model_full");
  }
  return t("model_pro");
}

export async function mountBoltWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  await ensureKatex();

  panel.classList.add("mechbox__workbench-panel--bolt");
  const genericActions = panel.querySelector(".mechbox__actions");
  const genericError = panel.querySelector(".mechbox__error");
  const genericResultTitle = panel.querySelector(".mechbox__result-title");
  const genericResult = panel.querySelector(".mechbox__result");
  [genericActions, genericError, genericResultTitle, genericResult].forEach(
    (el) => {
      if (el) {
        el.hidden = true;
      }
    }
  );

  const root = document.createElement("div");
  root.className = "mechbox-bolt";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-bolt__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-bolt__mode-tab";
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
  formulaBar.className = "mechbox-bolt__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-bolt__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-bolt__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const modeLegend = document.createElement("div");
  modeLegend.className = "mechbox-bolt__field mechbox-bolt__field--mode";
  const modeLabel = document.createElement("div");
  modeLabel.className = "mechbox-bolt__label";
  modeLabel.textContent = t("convert_direction");
  const modeGroup = document.createElement("div");
  modeGroup.className = "mechbox-bolt__radios";

  ["torque2force", "force2torque"].forEach((value, index) => {
    const label = document.createElement("label");
    label.className = "mechbox-bolt__radio";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "mode";
    radio.value = value;
    radio.checked = index === 0;
    radio.addEventListener("change", () => syncBoltModeFields(root));
    label.append(radio, radioModeLabel(value));
    modeGroup.append(label);
  });
  modeLegend.append(modeLabel, modeGroup);
  inputsCard.append(modeLegend);

  const diameterInput = numberInput("nominal_diameter_mm", "10");
  diameterInput.addEventListener("input", () => {
    syncDiameterHints(root);
  });
  const diameterHint = document.createElement("span");
  diameterHint.className = "mechbox-bolt__hint";
  diameterHint.dataset.diameterHint = "true";
  diameterHint.append(texNode("\\mathrm{M}10"));
  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: `${t("diameter")} ` }, { tex: "d" }]),
      diameterInput,
      diameterHint
    )
  );

  const pitchInput = numberInput("pitch_mm", "1.5");
  markUserEdited(pitchInput);
  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: `${t("pitch")} ` }, { tex: "P" }]),
      pitchInput,
      texNode("\\mathrm{mm}")
    )
  );

  const gradeSelect = document.createElement("select");
  gradeSelect.name = "grade";
  gradeSelect.className = "mechbox-bolt__select";
  BOLT_GRADES.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade;
    if (grade === "8.8") {
      option.selected = true;
    }
    gradeSelect.append(option);
  });
  inputsCard.append(fieldRow(document.createTextNode(t("grade")), gradeSelect));

  const nutFactorRow = fieldRow(
    mixedLabel([{ text: `${t("nut_factor")} ` }, { tex: "K" }]),
    numberInput("nut_factor", "0.2")
  );
  nutFactorRow.dataset.calcShow = "simple";
  inputsCard.append(nutFactorRow);

  const muGRow = fieldRow(
    mixedLabel([{ text: `${t("mu_g")} ` }, { tex: "\\mu_{G}" }]),
    numberInput("mu_g", "0.12")
  );
  muGRow.dataset.calcShow = "full professional";
  inputsCard.append(muGRow);

  const muKRow = fieldRow(
    mixedLabel([{ text: `${t("mu_k")} ` }, { tex: "\\mu_{K}" }]),
    numberInput("mu_k", "0.12")
  );
  muKRow.dataset.calcShow = "full professional";
  inputsCard.append(muKRow);

  const dKmInput = numberInput("d_km", String(defaultDKm(10)));
  markUserEdited(dKmInput);
  const dKmRow = fieldRow(
    mixedLabel([{ text: `${t("d_km")} ` }, { tex: "D_{km}" }]),
    dKmInput,
    texNode("\\mathrm{mm}")
  );
  dKmRow.dataset.calcShow = "full professional";
  inputsCard.append(dKmRow);

  const proTitle = sectionTitle(t("section_grip"));
  proTitle.dataset.calcShow = "professional";
  inputsCard.append(proTitle);

  const gripInput = numberInput("grip_length", String(defaultGrip(10)));
  markUserEdited(gripInput);
  gripInput.addEventListener("input", () => {
    const outer = root.querySelector('input[name="outer_diameter"]');
    if (outer && !outer.dataset.userEdited) {
      const d = parseDiameter(root);
      const head =
        Number(root.querySelector('input[name="head_contact_diameter"]')?.value) ||
        defaultHead(d);
      outer.value = String(defaultOuter(d, Number(gripInput.value), head));
    }
  });
  const gripRow = fieldRow(
    mixedLabel([{ text: `${t("grip_length")} ` }, { tex: "l_{K}" }]),
    gripInput,
    texNode("\\mathrm{mm}")
  );
  gripRow.dataset.calcShow = "professional";
  inputsCard.append(gripRow);

  const holeInput = numberInput("hole_diameter", String(defaultHole(10)));
  markUserEdited(holeInput);
  const holeRow = fieldRow(
    mixedLabel([{ text: `${t("hole_diameter")} ` }, { tex: "d_{h}" }]),
    holeInput,
    texNode("\\mathrm{mm}")
  );
  holeRow.dataset.calcShow = "professional";
  inputsCard.append(holeRow);

  const headInput = numberInput(
    "head_contact_diameter",
    String(defaultHead(10))
  );
  markUserEdited(headInput);
  headInput.addEventListener("input", () => {
    const outer = root.querySelector('input[name="outer_diameter"]');
    if (outer && !outer.dataset.userEdited) {
      const d = parseDiameter(root);
      const grip =
        Number(root.querySelector('input[name="grip_length"]')?.value) ||
        defaultGrip(d);
      outer.value = String(defaultOuter(d, grip, Number(headInput.value)));
    }
  });
  const headRow = fieldRow(
    mixedLabel([{ text: `${t("head_contact")} ` }, { tex: "d_{w}" }]),
    headInput,
    texNode("\\mathrm{mm}")
  );
  headRow.dataset.calcShow = "professional";
  inputsCard.append(headRow);

  const outerInput = numberInput(
    "outer_diameter",
    String(defaultOuter(10, defaultGrip(10), defaultHead(10)))
  );
  markUserEdited(outerInput);
  const outerRow = fieldRow(
    mixedLabel([{ text: `${t("outer_diameter")} ` }, { tex: "D_{A}" }]),
    outerInput,
    texNode("\\mathrm{mm}")
  );
  outerRow.dataset.calcShow = "professional";
  inputsCard.append(outerRow);

  const embedmentSelect = document.createElement("select");
  embedmentSelect.name = "embedment_preset";
  embedmentSelect.className = "mechbox-bolt__select";
  [
    ["steel_standard", t("embedment_steel_standard")],
    ["steel_fine", t("embedment_steel_fine")],
    ["aluminum", t("embedment_aluminum")],
    ["custom", t("embedment_custom")],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === "steel_standard") {
      option.selected = true;
    }
    embedmentSelect.append(option);
  });
  embedmentSelect.addEventListener("change", () => {
    syncCalcModeVisibility(root);
    if (embedmentSelect.value !== "custom") {
      const custom = root.querySelector('input[name="embedment_um"]');
      if (custom) {
        custom.value = String(EMBEDMENT_PRESETS[embedmentSelect.value] || 11);
      }
    }
  });
  const embedmentRow = fieldRow(
    mixedLabel([{ text: `${t("embedment")} ` }, { tex: "f_{Z}" }]),
    embedmentSelect
  );
  embedmentRow.dataset.calcShow = "professional";
  inputsCard.append(embedmentRow);

  const embedmentCustomInput = numberInput(
    "embedment_um",
    String(EMBEDMENT_PRESETS.steel_standard)
  );
  const embedmentCustomRow = fieldRow(
    mixedLabel([{ text: `${t("embedment_custom")} ` }, { tex: "f_{Z}" }]),
    embedmentCustomInput,
    texNode("\\mathrm{\\mu m}")
  );
  embedmentCustomRow.dataset.field = "embedment_um";
  embedmentCustomRow.dataset.calcShow = "professional";
  embedmentCustomRow.classList.add("is-mode-hidden");
  inputsCard.append(embedmentCustomRow);

  const deltaTRow = fieldRow(
    mixedLabel([{ text: `${t("delta_t")} ` }, { tex: "\\Delta T" }]),
    numberInput("delta_t", "0"),
    texNode("\\mathrm{^{\\circ}C}")
  );
  deltaTRow.dataset.calcShow = "professional";
  inputsCard.append(deltaTRow);

  const externalRow = fieldRow(
    mixedLabel([{ text: `${t("external_axial")} ` }, { tex: "F_{A}" }]),
    numberInput("external_axial_load", "0"),
    texNode("\\mathrm{N}")
  );
  externalRow.dataset.calcShow = "professional";
  inputsCard.append(externalRow);

  const torqueRow = fieldRow(
    mixedLabel([{ text: `${t("torque")} ` }, { tex: "T" }]),
    numberInput("torque_nm", "50"),
    texNode("\\mathrm{N\\cdot m}")
  );
  torqueRow.dataset.field = "torque_nm";
  inputsCard.append(torqueRow);

  const preloadRow = fieldRow(
    mixedLabel([{ text: `${t("preload")} ` }, { tex: "F" }]),
    numberInput("preload_n", "20000"),
    texNode("\\mathrm{N}")
  );
  preloadRow.dataset.field = "preload_n";
  preloadRow.classList.add("is-mode-hidden");
  inputsCard.append(preloadRow);

  inputsCard.append(boltDiagramSvg());

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-bolt__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateBolt(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-bolt__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-bolt__card mechbox-bolt__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-bolt__results-body";
  const empty = document.createElement("div");
  empty.className = "mechbox-bolt__results-empty";
  empty.textContent = t("results_empty");
  resultsBody.append(empty);
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.replaceChildren(root);

  applyCalcMode(root, "simple");
  syncDiameterHints(root);
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}
