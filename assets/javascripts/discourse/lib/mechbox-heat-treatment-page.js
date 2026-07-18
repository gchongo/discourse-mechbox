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
const STEEL_PRESETS = ["1045", "4140", "4340", "8620"];
const ELEMENTS = ["C", "Mn", "Cr", "Mo", "V", "Ni", "Cu"];

const PRESET_COMPOSITION = {
  "1045": { C: "0.45", Mn: "0.75", Cr: "0", Mo: "0", V: "0", Ni: "0", Cu: "0" },
  "4140": { C: "0.4", Mn: "0.85", Cr: "0.95", Mo: "0.2", V: "0", Ni: "0", Cu: "0" },
  "4340": { C: "0.4", Mn: "0.75", Cr: "0.8", Mo: "0.25", V: "0", Ni: "1.8", Cu: "0" },
  "8620": { C: "0.2", Mn: "0.85", Cr: "0.5", Mo: "0.2", V: "0", Ni: "0.55", Cu: "0" },
};

const WORKBENCH_PANEL_CLASSES = [
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
  "mechbox__workbench-panel--manufacturing",
  "mechbox__workbench-panel--heat-treatment",
  "mechbox__workbench-panel--materials",
  "mechbox__workbench-panel--material-selection",
];

function t(key, options) {
  return i18n(`mechbox.heat_treatment.${key}`, options);
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
  row.className = "mechbox-heat-treatment__field";
  const label = document.createElement("label");
  label.className = "mechbox-heat-treatment__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-heat-treatment__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-heat-treatment__unit";
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
  input.className = "mechbox__inputs mechbox-heat-treatment__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-heat-treatment__select";
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
  const bar = root.querySelector(".mechbox-heat-treatment__formula-bar");
  if (!bar) {
    return;
  }

  fillFormulaBar(bar, {
    title: t("formula_title"),
    hint: t("formula_hint"),
    formulas: [
      "CE=C+\\frac{Mn}{6}+\\frac{Cr+Mo+V}{5}+\\frac{Ni+Cu}{15}",
    ],
  });
  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function applySteelPreset(root, presetId) {
  const preset = PRESET_COMPOSITION[presetId] || PRESET_COMPOSITION["4140"];
  ELEMENTS.forEach((el) => {
    const input = root.querySelector(`input[name="${el}"]`);
    if (input) {
      input.value = preset[el];
    }
  });
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    steel_preset: root.querySelector('select[name="steel_preset"]')?.value || "4140",
  };

  ELEMENTS.forEach((el) => {
    inputs[el] = Number(root.querySelector(`input[name="${el}"]`)?.value);
  });

  if (calcMode !== "simple") {
    inputs.grain_size = Number(root.querySelector('input[name="grain_size"]')?.value || 7);
    inputs.part_diameter_mm = Number(
      root.querySelector('input[name="part_diameter_mm"]')?.value || 50
    );
    inputs.temper_temp_c = Number(root.querySelector('input[name="temper_temp_c"]')?.value || 550);
    inputs.temper_time_h = Number(root.querySelector('input[name="temper_time_h"]')?.value || 2);
  }

  if (calcMode === "professional") {
    inputs.min_final_hrc = Number(root.querySelector('input[name="min_final_hrc"]')?.value || 28);
    inputs.max_final_hrc = Number(root.querySelector('input[name="max_final_hrc"]')?.value || 45);
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-heat-treatment__result-row";
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

function weldabilityText(key) {
  if (!key) {
    return "—";
  }
  const translated = t(`weldability_${key}`);
  return translated.includes("translation missing") ? key : translated;
}

function verdictText(key) {
  if (!key) {
    return "—";
  }
  const translated = t(`verdict_${key}`);
  return translated.includes("translation missing") ? key : translated;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-heat-treatment__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  const hard = outputs.hardenability || {};
  const temper = outputs.temper;

  box.replaceChildren();
  box.classList.add("is-visible");

  const hasPass = typeof outputs.pass === "boolean";
  const status = document.createElement("div");
  status.className = `mechbox-heat-treatment__status ${
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
  list.className = "mechbox-heat-treatment__result-list";

  list.append(
    resultRow(
      [{ text: t("result_ce") }],
      [{ text: formatNumber(outputs.carbon_equivalent, 3) }]
    ),
    resultRow(
      [{ text: t("result_weldability") }],
      [{ text: weldabilityText(outputs.weldability_key) }]
    ),
    resultRow(
      [{ text: t("result_surface_hrc") }],
      [{ text: `${formatNumber(hard.surface_hrc, 1)} HRC` }]
    )
  );

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: t("result_core_hrc") }],
        [{ text: `${formatNumber(hard.estimated_core_hrc, 1)} HRC` }]
      ),
      resultRow(
        [{ text: t("result_di") }],
        [{ text: `${formatNumber(hard.ideal_critical_diameter_mm, 1)} mm` }]
      ),
      resultRow(
        [{ text: t("result_verdict") }],
        [{ text: verdictText(hard.verdict_key) }]
      ),
      resultRow(
        [{ text: t("result_preheat") }],
        [
          {
            text: outputs.preheat_required
              ? `${formatNumber(outputs.preheat_temp_c, 0)} °C`
              : t("preheat_none"),
          },
        ]
      )
    );

    if (temper?.tempered_hrc != null) {
      list.append(
        resultRow(
          [{ text: t("result_tempered_hrc") }],
          [{ text: `${formatNumber(temper.tempered_hrc, 1)} HRC` }]
        )
      );
    }
  }

  if (calcMode === "professional" && typeof outputs.final_hardness_pass === "boolean") {
    list.append(
      resultRow(
        [{ text: t("result_final_hardness") }],
        [{ text: outputs.final_hardness_pass ? t("status_pass") : t("status_attention") }],
        { danger: outputs.final_hardness_pass === false }
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-heat-treatment__error");
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

async function calculateHeatTreatment(panel, button) {
  const root = panel.querySelector(".mechbox-heat-treatment");
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
        tool_id: "heat_treatment",
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

export async function mountHeatTreatmentWorkbench(panel) {
  await ensureKatex();

  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--heat-treatment");

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
  root.className = "mechbox-heat-treatment";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-heat-treatment__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-heat-treatment__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-heat-treatment__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-heat-treatment__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-heat-treatment__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const presetSelect = selectInput(
    "steel_preset",
    STEEL_PRESETS.map((id) => [id, t(`preset_${id}`) || id]),
    "4140"
  );
  presetSelect.addEventListener("change", () => applySteelPreset(root, presetSelect.value));
  inputsCard.append(
    fieldRow(document.createTextNode(t("steel_preset")), presetSelect, document.createTextNode(""))
  );

  const defaultComp = PRESET_COMPOSITION["4140"];
  ELEMENTS.forEach((el) => {
    const row = fieldRow(
      document.createTextNode(el),
      numberInput(el, defaultComp[el]),
      document.createTextNode("%")
    );
    inputsCard.append(row);
  });

  const grainRow = fieldRow(
    document.createTextNode(t("grain_size")),
    numberInput("grain_size", "7"),
    document.createTextNode("ASTM")
  );
  grainRow.dataset.calcShow = "full professional";
  inputsCard.append(grainRow);

  const diameterRow = fieldRow(
    document.createTextNode(t("part_diameter")),
    numberInput("part_diameter_mm", "50"),
    document.createTextNode("mm")
  );
  diameterRow.dataset.calcShow = "full professional";
  inputsCard.append(diameterRow);

  const temperTempRow = fieldRow(
    document.createTextNode(t("temper_temp")),
    numberInput("temper_temp_c", "550"),
    document.createTextNode("°C")
  );
  temperTempRow.dataset.calcShow = "full professional";
  inputsCard.append(temperTempRow);

  const temperTimeRow = fieldRow(
    document.createTextNode(t("temper_time")),
    numberInput("temper_time_h", "2"),
    document.createTextNode("h")
  );
  temperTimeRow.dataset.calcShow = "full professional";
  inputsCard.append(temperTimeRow);

  const minHrcRow = fieldRow(
    document.createTextNode(t("min_final_hrc")),
    numberInput("min_final_hrc", "28"),
    document.createTextNode("HRC")
  );
  minHrcRow.dataset.calcShow = "professional";
  inputsCard.append(minHrcRow);

  const maxHrcRow = fieldRow(
    document.createTextNode(t("max_final_hrc")),
    numberInput("max_final_hrc", "45"),
    document.createTextNode("HRC")
  );
  maxHrcRow.dataset.calcShow = "professional";
  inputsCard.append(maxHrcRow);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-heat-treatment__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateHeatTreatment(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-heat-treatment__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-heat-treatment__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-heat-treatment__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
