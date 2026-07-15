import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  mixedLabel,
  texNode,
  typesetRoot,
} from "./mechbox-tex";

const CALC_MODES = ["simple", "full", "professional"];

const KEY_SIZE_TABLE = [
  { dMin: 6, dMax: 8, width: 2, height: 2 },
  { dMin: 8, dMax: 10, width: 3, height: 3 },
  { dMin: 10, dMax: 12, width: 4, height: 4 },
  { dMin: 12, dMax: 17, width: 5, height: 5 },
  { dMin: 17, dMax: 22, width: 6, height: 6 },
  { dMin: 22, dMax: 30, width: 8, height: 7 },
  { dMin: 30, dMax: 38, width: 10, height: 8 },
  { dMin: 38, dMax: 44, width: 12, height: 8 },
  { dMin: 44, dMax: 50, width: 14, height: 9 },
];

function t(key, options) {
  return i18n(`mechbox.key.${key}`, options);
}

function lookupKeySize(shaftDiameter) {
  const d = Number(shaftDiameter) || 30;
  return (
    KEY_SIZE_TABLE.find((r) => d >= r.dMin && d <= r.dMax) ||
    KEY_SIZE_TABLE[KEY_SIZE_TABLE.length - 1]
  );
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
  row.className = "mechbox-key__field";

  const label = document.createElement("label");
  label.className = "mechbox-key__label";
  label.append(labelEl);

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-key__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-key__unit";
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
  input.className = "mechbox__inputs mechbox-key__input";
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

function getCalcMode(root) {
  return root.dataset.calcMode || "simple";
}

function setCalcMode(root, mode) {
  root.dataset.calcMode = mode;
}

function syncCalcModeVisibility(root) {
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

function syncStdKeyHints(root) {
  const shaft =
    Number(root.querySelector('input[name="shaft_diameter_mm"]')?.value) || 30;
  const std = lookupKeySize(shaft);
  const hint = root.querySelector("[data-std-key-hint]");
  const width = root.querySelector('input[name="key_width_mm"]');
  const height = root.querySelector('input[name="key_height_mm"]');
  const length = root.querySelector('input[name="key_length_mm"]');
  const hub = root.querySelector('input[name="hub_length_mm"]');

  if (hint) {
    hint.textContent = `${std.width}×${std.height}`;
  }

  if (width && !width.dataset.userEdited) {
    width.value = String(std.width);
  }
  if (height && !height.dataset.userEdited) {
    height.value = String(std.height);
  }
  if (length && !length.dataset.userEdited) {
    length.value = String(Math.round(std.width * 3.5));
  }
  if (hub && !hub.dataset.userEdited) {
    const len = Number(length?.value) || Math.round(std.width * 3.5);
    hub.value = String(len);
  }
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-key__formula-bar");
  const warning = root.querySelector(".mechbox-key__warning");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  bar.replaceChildren();
  const title = document.createElement("strong");

  if (calcMode === "simple") {
    title.textContent = t("formula_title");
    bar.append(title);
    bar.append(texNode("F_t=2000T/d", { displayMode: true }));
    bar.append(
      texNode("\\tau=F/(b L),\\quad \\sigma_c=2F/(h L_h)", {
        displayMode: true,
      })
    );
    if (warning) {
      warning.textContent = t("estimate_warning");
      warning.hidden = false;
    }
  } else if (calcMode === "full") {
    title.textContent = t("formula_title_full");
    bar.append(title);
    bar.append(
      texNode("L_{\\min}=\\max\\!\\left(\\dfrac{F}{b[\\tau]},\\dfrac{2F}{h[\\sigma_c]}\\right)", {
        displayMode: true,
      })
    );
    if (warning) {
      warning.textContent = t("estimate_warning_full");
      warning.hidden = false;
    }
  } else {
    title.textContent = t("formula_title_pro");
    bar.append(title);
    bar.append(
      texNode("F_i=F_t/n,\\quad \\tau_a=F_a/(b L)", { displayMode: true })
    );
    if (warning) {
      warning.textContent = t("estimate_warning_pro");
      warning.hidden = false;
    }
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
  syncCalcModeVisibility(root);
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
  row.className = "mechbox-key__result-row";
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

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    torque_nm: Number(root.querySelector('input[name="torque_nm"]')?.value),
    shaft_diameter_mm: Number(
      root.querySelector('input[name="shaft_diameter_mm"]')?.value
    ),
    key_width_mm: Number(
      root.querySelector('input[name="key_width_mm"]')?.value
    ),
    key_height_mm: Number(
      root.querySelector('input[name="key_height_mm"]')?.value
    ),
    key_length_mm: Number(
      root.querySelector('input[name="key_length_mm"]')?.value
    ),
    allow_shear_mpa: Number(
      root.querySelector('input[name="allow_shear_mpa"]')?.value
    ),
    allow_crush_mpa: Number(
      root.querySelector('input[name="allow_crush_mpa"]')?.value
    ),
  };

  if (calcMode !== "simple") {
    inputs.hub_length_mm = Number(
      root.querySelector('input[name="hub_length_mm"]')?.value
    );
  }

  if (calcMode === "professional") {
    inputs.key_count = Number(
      root.querySelector('input[name="key_count"]')?.value
    );
    inputs.torque_amplitude_nm = Number(
      root.querySelector('input[name="torque_amplitude_nm"]')?.value
    );
  }

  return inputs;
}

function appendFormulaBox(box, calcMode) {
  const formulaBox = document.createElement("div");
  formulaBox.className = "mechbox-key__formula-box";
  const formulaTitle = document.createElement("div");
  formulaTitle.className = "mechbox-key__formula-box-title";

  if (calcMode === "simple") {
    formulaTitle.textContent = t("formula_title");
    formulaBox.append(formulaTitle);
    formulaBox.append(texNode("F_t=2000T/d", { displayMode: true }));
    formulaBox.append(texNode("\\tau=F/(b L)", { displayMode: true }));
    formulaBox.append(texNode("\\sigma_c=2F/(h L_h)", { displayMode: true }));
  } else if (calcMode === "full") {
    formulaTitle.textContent = t("formula_title_full");
    formulaBox.append(formulaTitle);
    formulaBox.append(
      texNode("L_{\\min}=\\max(F/(b[\\tau]), 2F/(h[\\sigma_c]))", {
        displayMode: true,
      })
    );
  } else {
    formulaTitle.textContent = t("formula_title_pro");
    formulaBox.append(formulaTitle);
    formulaBox.append(texNode("\\tau_a \\le 0.5[\\tau]", { displayMode: true }));
  }

  box.append(formulaBox);
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-key__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-key__status ${
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
  list.className = "mechbox-key__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_force")} ` }, { tex: "F_t" }],
      [{ tex: `${formatNumber(outputs.tangential_force_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: t("result_key_size") }],
      [
        {
          tex: `${formatNumber(outputs.key_width_mm, 1)}\\times${formatNumber(outputs.key_height_mm, 1)}\\times${formatNumber(outputs.key_length_mm, 1)}\\,\\mathrm{mm}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("result_shear")} ` }, { tex: "\\tau" }],
      [
        {
          tex: `${formatNumber(outputs.shear_stress_mpa, 1)}\\,\\mathrm{MPa}`,
        },
      ],
      { danger: outputs.shear_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_crush")} ` }, { tex: "\\sigma_c" }],
      [
        {
          tex: `${formatNumber(outputs.crush_stress_mpa, 1)}\\,\\mathrm{MPa}`,
        },
      ],
      { danger: outputs.crush_pass === false }
    ),
    resultRow(
      [{ text: t("result_allow") }],
      [
        {
          tex: `[\\tau]=${formatNumber(outputs.allow_shear_mpa, 0)},\\;[\\sigma_c]=${formatNumber(outputs.allow_crush_mpa, 0)}\\,\\mathrm{MPa}`,
        },
      ]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_recommended_length") }],
        [
          {
            tex: `${formatNumber(outputs.recommended_length_mm, 1)}\\,\\mathrm{mm}`,
          },
        ],
        { danger: outputs.length_pass === false }
      ),
      resultRow(
        [{ text: t("result_utilization") }],
        [
          {
            tex: `${formatNumber(Number(outputs.shear_utilization) * 100, 1)}\\%\\,/\\,${formatNumber(Number(outputs.crush_utilization) * 100, 1)}\\%`,
          },
        ]
      )
    );
  }

  if (calcMode === "professional") {
    if (outputs.shear_amplitude_mpa != null) {
      list.append(
        resultRow(
          [{ text: `${t("result_shear_amp")} ` }, { tex: "\\tau_a" }],
          [
            {
              tex: `${formatNumber(outputs.shear_amplitude_mpa, 1)}\\,\\mathrm{MPa}`,
            },
          ],
          { danger: outputs.fatigue_pass === false }
        )
      );
    }
    list.append(
      resultRow(
        [{ text: t("result_key_count") }],
        [{ text: String(outputs.key_count ?? 1) }]
      )
    );
  }

  box.append(list);
  appendFormulaBox(box, calcMode);
  await typesetRoot(box);
}

function setKeyError(panel, message) {
  const error = panel.querySelector(".mechbox-key__error");
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

async function calculateKey(panel, button) {
  const root = panel.querySelector(".mechbox-key");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setKeyError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "key",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setKeyError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountKeyWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  await ensureKatex();

  panel.classList.remove(
    "mechbox__workbench-panel--bolt",
    "mechbox__workbench-panel--units",
    "mechbox__workbench-panel--rss",
    "mechbox__workbench-panel--gdt",
    "mechbox__workbench-panel--thread"
  );
  panel.classList.add("mechbox__workbench-panel--key");

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
  root.className = "mechbox-key";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-key__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-key__mode-tab";
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
  formulaBar.className = "mechbox-key__formula-bar";
  const warning = document.createElement("p");
  warning.className = "mechbox-key__warning";

  const grid = document.createElement("div");
  grid.className = "mechbox-key__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-key__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const torqueInput = numberInput("torque_nm", "200");
  const shaftInput = numberInput("shaft_diameter_mm", "30");
  shaftInput.addEventListener("input", () => syncStdKeyHints(root));

  const widthInput = numberInput("key_width_mm", "8");
  const heightInput = numberInput("key_height_mm", "7");
  const lengthInput = numberInput("key_length_mm", "28");
  const hubInput = numberInput("hub_length_mm", "28");
  markUserEdited(widthInput);
  markUserEdited(heightInput);
  markUserEdited(lengthInput);
  markUserEdited(hubInput);

  const allowShearInput = numberInput("allow_shear_mpa", "100");
  const allowCrushInput = numberInput("allow_crush_mpa", "150");
  const keyCountInput = numberInput("key_count", "1");
  const ampInput = numberInput("torque_amplitude_nm", "0");

  const stdHint = document.createElement("span");
  stdHint.dataset.stdKeyHint = "true";
  stdHint.className = "mechbox-key__hint";

  const applyStdBtn = document.createElement("button");
  applyStdBtn.type = "button";
  applyStdBtn.className = "btn btn-default btn-small";
  applyStdBtn.textContent = t("apply_std_key");
  applyStdBtn.addEventListener("click", (event) => {
    event.preventDefault();
    delete widthInput.dataset.userEdited;
    delete heightInput.dataset.userEdited;
    delete lengthInput.dataset.userEdited;
    delete hubInput.dataset.userEdited;
    syncStdKeyHints(root);
  });

  const hubRow = fieldRow(
    mixedLabel([{ text: t("hub_length") }, { text: " " }, { tex: "L_h" }]),
    hubInput,
    document.createTextNode("mm")
  );
  hubRow.dataset.calcShow = "full professional";

  const countRow = fieldRow(
    document.createTextNode(t("key_count")),
    keyCountInput,
    document.createTextNode("—")
  );
  countRow.dataset.calcShow = "professional";

  const ampRow = fieldRow(
    mixedLabel([{ text: t("torque_amplitude") }, { text: " " }, { tex: "T_a" }]),
    ampInput,
    document.createTextNode("N·m")
  );
  ampRow.dataset.calcShow = "professional";

  const stdRow = document.createElement("div");
  stdRow.className = "mechbox-key__field";
  stdRow.dataset.calcShow = "full professional";
  const stdLabel = document.createElement("label");
  stdLabel.className = "mechbox-key__label";
  stdLabel.textContent = t("std_key");
  const stdControl = document.createElement("div");
  stdControl.className = "mechbox-key__control";
  stdControl.append(stdHint, document.createTextNode(" mm "), applyStdBtn);
  stdRow.append(stdLabel, stdControl, document.createElement("span"));

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("torque") }, { text: " " }, { tex: "T" }]),
      torqueInput,
      document.createTextNode("N·m")
    ),
    fieldRow(
      mixedLabel([{ text: t("shaft_diameter") }, { text: " " }, { tex: "d" }]),
      shaftInput,
      document.createTextNode("mm")
    ),
    stdRow,
    fieldRow(
      mixedLabel([{ text: t("key_width") }, { text: " " }, { tex: "b" }]),
      widthInput,
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("key_height") }, { text: " " }, { tex: "h" }]),
      heightInput,
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("key_length") }, { text: " " }, { tex: "L" }]),
      lengthInput,
      document.createTextNode("mm")
    ),
    hubRow,
    fieldRow(
      mixedLabel([{ text: t("allow_shear") }, { text: " " }, { tex: "[\\tau]" }]),
      allowShearInput,
      document.createTextNode("MPa")
    ),
    fieldRow(
      mixedLabel([
        { text: t("allow_crush") },
        { text: " " },
        { tex: "[\\sigma_c]" },
      ]),
      allowCrushInput,
      document.createTextNode("MPa")
    ),
    countRow,
    ampRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-key__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateKey(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-key__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-key__card mechbox-key__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-key__results-body";
  resultsBody.innerHTML = `<p class="mechbox-key__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, warning, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
  syncStdKeyHints(root);
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}
