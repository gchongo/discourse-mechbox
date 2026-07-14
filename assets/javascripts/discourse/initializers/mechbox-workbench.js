import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  mixedLabel,
  texNode,
  typesetRoot,
} from "../lib/mechbox-tex";

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

let handlersRegistered = false;

function t(key, options) {
  return i18n(`mechbox.bolt.${key}`, options);
}

function parseInputsSchema(panel) {
  const raw = panel.getAttribute("data-inputs-json");

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function suggestedPitch(diameter) {
  return METRIC_THREAD_PITCH[Math.round(Number(diameter))] || 1.5;
}

function fieldRow(labelEl, control, hintEl) {
  const row = document.createElement("div");
  row.className = "mechbox-bolt__field";

  const label = document.createElement("label");
  label.className = "mechbox-bolt__label";
  label.append(labelEl);

  const colon = document.createElement("span");
  colon.className = "mechbox-bolt__colon";
  colon.textContent = "：";

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-bolt__control";
  controlWrap.append(control);

  row.append(label, colon, controlWrap);

  if (hintEl) {
    const unit = document.createElement("span");
    unit.className = "mechbox-bolt__unit";
    unit.append(hintEl);
    row.append(unit);
  }

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

function syncDiameterHints(root) {
  const diameter = root.querySelector('input[name="nominal_diameter_mm"]')?.value;
  const pitch = root.querySelector('input[name="pitch_mm"]');
  const hint = root.querySelector("[data-diameter-hint]");

  if (hint && diameter) {
    hint.replaceChildren();
    hint.append(texNode(`\\mathrm{M}${diameter}`));
    typesetRoot(hint);
  }

  if (pitch && !pitch.dataset.userEdited) {
    pitch.value = String(suggestedPitch(diameter));
  }
}

function collectBoltInputs(root) {
  const mode =
    root.querySelector('input[name="mode"]:checked')?.value || "torque2force";
  const inputs = {
    mode,
    grade: root.querySelector('select[name="grade"]')?.value || "8.8",
    nut_factor: Number(root.querySelector('input[name="nut_factor"]')?.value),
    nominal_diameter_mm: Number(
      root.querySelector('input[name="nominal_diameter_mm"]')?.value
    ),
    pitch_mm: Number(root.querySelector('input[name="pitch_mm"]')?.value),
  };

  if (mode === "torque2force") {
    inputs.torque_nm = Number(root.querySelector('input[name="torque_nm"]')?.value);
  } else {
    inputs.preload_n = Number(root.querySelector('input[name="preload_n"]')?.value);
  }

  return inputs;
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }

  // Avoid locale thousand separators — these strings are embedded in TeX.
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

async function renderBoltResults(panel, payload) {
  const box = panel.querySelector(".mechbox-bolt__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || payload || {};
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
  box.append(list);

  const formulaBox = document.createElement("div");
  formulaBox.className = "mechbox-bolt__formula-box";
  const formulaTitle = document.createElement("div");
  formulaTitle.className = "mechbox-bolt__formula-box-title";
  formulaTitle.textContent = t("formula_title");
  formulaBox.append(formulaTitle);
  formulaBox.append(
    texNode("T = K \\cdot F \\cdot d", { displayMode: true })
  );
  formulaBox.append(
    texNode("F = \\dfrac{T}{K \\cdot d}", { displayMode: true })
  );
  formulaBox.append(
    texNode("\\sigma = \\dfrac{F}{A_{s}}", { displayMode: true })
  );
  box.append(formulaBox);

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

async function mountBoltWorkbench(panel) {
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

  const modes = document.createElement("div");
  modes.className = "mechbox-bolt__modes";
  const simpleBtn = document.createElement("span");
  simpleBtn.className = "mechbox-bolt__mode-tab is-active";
  simpleBtn.textContent = t("model_simple");
  const fullBtn = document.createElement("span");
  fullBtn.className = "mechbox-bolt__mode-tab is-disabled";
  fullBtn.textContent = `${t("model_full")} (${t("model_coming_soon")})`;
  const proBtn = document.createElement("span");
  proBtn.className = "mechbox-bolt__mode-tab is-disabled";
  proBtn.textContent = `${t("model_pro")} (${t("model_coming_soon")})`;
  modes.append(simpleBtn, fullBtn, proBtn);

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-bolt__formula-bar";
  const formulaTitle = document.createElement("strong");
  formulaTitle.textContent = t("formula_title");
  formulaBar.append(formulaTitle);
  formulaBar.append(texNode("T = K \\cdot F \\cdot d", { displayMode: true }));

  const warning = document.createElement("p");
  warning.className = "mechbox-bolt__warning";
  warning.textContent = t("estimate_warning");

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
  const modeColon = document.createElement("span");
  modeColon.className = "mechbox-bolt__colon";
  modeColon.textContent = "：";
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
  modeLegend.append(modeLabel, modeColon, modeGroup);
  inputsCard.append(modeLegend);

  const diameterInput = numberInput("nominal_diameter_mm", "10");
  diameterInput.addEventListener("input", () => syncDiameterHints(root));
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
  pitchInput.addEventListener("input", () => {
    pitchInput.dataset.userEdited = "true";
  });
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

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: `${t("nut_factor")} ` }, { tex: "K" }]),
      numberInput("nut_factor", "0.2")
    )
  );

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
  root.append(modes, formulaBar, warning, grid);
  mount.replaceChildren(root);

  syncBoltModeFields(root);
  syncDiameterHints(root);
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}

function mountGenericWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");

  if (!mount) {
    return;
  }

  panel.classList.remove("mechbox__workbench-panel--bolt");
  mount.replaceChildren();

  for (const field of parseInputsSchema(panel)) {
    const key = field?.key;

    if (!key) {
      continue;
    }

    const label = document.createElement("label");
    label.className = "mechbox__input-label";
    label.htmlFor = `mechbox-input-${key}`;
    label.textContent = key;

    const input = document.createElement("input");
    input.id = `mechbox-input-${key}`;
    input.type = "text";
    input.className = "mechbox__inputs";
    input.name = key;
    input.dataset.type = field.type || "string";
    input.autocomplete = "off";

    mount.append(label, input);
  }

  panel.dataset.mounted = "true";
}

function mountWorkbenchForm(panel) {
  if (!panel || panel.dataset.mounted === "true") {
    return;
  }

  if (panel.dataset.toolId === "bolt_clamp_load") {
    mountBoltWorkbench(panel);
  } else {
    mountGenericWorkbench(panel);
  }
}

function mountAllWorkbenchForms() {
  document
    .querySelectorAll(".mechbox__workbench-panel:not([data-mounted='true'])")
    .forEach(mountWorkbenchForm);
}

function parsedInputs(panel) {
  const inputs = {};

  for (const input of panel.querySelectorAll(".mechbox__inputs[name]")) {
    const key = input.getAttribute("name");
    const type = input.dataset.type;
    const raw = input.value;

    if (type === "number" || type === "integer") {
      inputs[key] = raw === "" ? null : Number(raw);
    } else {
      inputs[key] = raw;
    }
  }

  return inputs;
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox__error");

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

function setResult(panel, result) {
  const resultEl = panel.querySelector(".mechbox__result");
  const titleEl = panel.querySelector(".mechbox__result-title");

  if (!resultEl) {
    return;
  }

  if (result) {
    resultEl.textContent = JSON.stringify(result, null, 2);
    resultEl.hidden = false;
    if (titleEl) {
      titleEl.hidden = false;
    }
  } else {
    resultEl.textContent = "";
    resultEl.hidden = true;
    if (titleEl) {
      titleEl.hidden = true;
    }
  }
}

async function calculateGeneric(event) {
  const button = event.target.closest(".mechbox__calculate-btn");

  if (!button || button.disabled) {
    return;
  }

  if (button.classList.contains("mechbox-bolt__calculate-btn")) {
    return;
  }

  const panel = button.closest(".mechbox__workbench-panel");

  if (!panel || panel.dataset.toolId === "bolt_clamp_load") {
    return;
  }

  const toolId = panel.dataset.toolId;

  if (!toolId) {
    return;
  }

  event.preventDefault();
  mountWorkbenchForm(panel);

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setError(panel, null);
  setResult(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: toolId,
        save_record: false,
        inputs: parsedInputs(panel),
      },
    });

    setResult(panel, result);
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

function registerHandlers(api) {
  if (handlersRegistered || typeof document === "undefined") {
    return;
  }

  document.addEventListener("click", calculateGeneric);

  const observer = new MutationObserver(() => {
    mountAllWorkbenchForms();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  api.onPageChange(() => mountAllWorkbenchForms());
  mountAllWorkbenchForms();

  handlersRegistered = true;
}

export default {
  name: "discourse-mechbox-workbench",

  initialize() {
    withPluginApi((api) => {
      registerHandlers(api);
    });
  },
};
