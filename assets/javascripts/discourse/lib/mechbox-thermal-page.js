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
  "steel",
  "stainless",
  "cast_iron",
  "aluminum",
  "copper",
  "brass",
  "titanium",
];
// Preset alpha in ×10⁻⁶ /°C to prefill the override field on material change.
const MATERIAL_ALPHA_MICRO = {
  steel: 11.5,
  stainless: 17.3,
  cast_iron: 10.5,
  aluminum: 23.6,
  copper: 17.0,
  brass: 18.7,
  titanium: 8.6,
};

function t(key, options) {
  return i18n(`mechbox.thermal_expansion.${key}`, options);
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-thermal__field";
  const label = document.createElement("label");
  label.className = "mechbox-thermal__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-thermal__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-thermal__unit";
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
  input.className = "mechbox__inputs mechbox-thermal__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function materialSelect(name) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-thermal__select";
  select.name = name;
  MATERIALS.forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = t(`material_${key}`);
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

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-thermal__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["\\Delta L=\\alpha\\,L\\,\\Delta T"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\Delta d=\\alpha\\,d\\,\\Delta T",
        "I_{f}=I_{0}+(\\Delta d_{s}-\\Delta d_{h})",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "\\bar{\\alpha}=\\alpha\\left(1+\\tfrac{k\\,\\Delta T}{2}\\right)",
        "I_{service}=f(\\Delta T_{asm},\\Delta T_{svc})",
      ],
    });
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncModeTabs(root);
  syncVisibility(root);
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
  row.className = "mechbox-thermal__result-row";
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
    material: root.querySelector('select[name="material"]')?.value || "steel",
    length_mm: Number(root.querySelector('input[name="length_mm"]')?.value),
    delta_t: Number(root.querySelector('input[name="delta_t"]')?.value),
  };

  const alphaMicro = root.querySelector('input[name="alpha_micro"]')?.value;
  if (alphaMicro) {
    inputs.alpha_micro = Number(alphaMicro);
  }

  if (calcMode === "full" || calcMode === "professional") {
    inputs.material2 =
      root.querySelector('select[name="material2"]')?.value || "steel";
    const alpha2Micro = root.querySelector('input[name="alpha2_micro"]')?.value;
    if (alpha2Micro) {
      inputs.alpha2_micro = Number(alpha2Micro);
    }
    const shaft = root.querySelector('input[name="shaft_diameter_mm"]')?.value;
    const hole = root.querySelector('input[name="hole_diameter_mm"]')?.value;
    if (shaft) {
      inputs.shaft_diameter_mm = Number(shaft);
    }
    if (hole) {
      inputs.hole_diameter_mm = Number(hole);
    }
  }

  if (calcMode === "professional") {
    const asm = root.querySelector('input[name="assembly_delta_t"]')?.value;
    const svc = root.querySelector('input[name="service_delta_t"]')?.value;
    if (asm !== undefined && asm !== "") {
      inputs.assembly_delta_t = Number(asm);
    }
    if (svc !== undefined && svc !== "") {
      inputs.service_delta_t = Number(svc);
    }
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-thermal__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-thermal__status ${
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
  list.className = "mechbox-thermal__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_linear")} ` }, { tex: "\\Delta L" }],
      [{ tex: `${formatNumber(outputs.linear_expansion, 4)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: t("result_operating_temp") }],
      [{ text: `${formatNumber(outputs.operating_temp, 1)} °C` }]
    ),
    resultRow(
      [{ text: `${t("result_alpha")} ` }, { tex: "\\alpha" }],
      [{ tex: `${formatNumber(outputs.alpha1_micro, 2)}\\times10^{-6}` }]
    )
  );

  if (calcMode === "professional" && outputs.alpha_temperature_used) {
    list.append(
      resultRow(
        [{ text: t("result_alpha_operating") }],
        [{ tex: `${formatNumber(outputs.alpha_at_operating, 2)}\\times10^{-6}` }]
      )
    );
  }

  const fit = outputs.fit;
  if ((calcMode === "full" || calcMode === "professional") && fit) {
    list.append(
      resultRow(
        [{ text: t("result_initial_interference") }],
        [{ tex: `${formatNumber(fit.initial_interference, 4)}\\,\\mathrm{mm}` }]
      ),
      resultRow(
        [{ text: t("result_interference_change") }],
        [{ tex: `${formatNumber(fit.interference_change, 4)}\\,\\mathrm{mm}` }]
      ),
      resultRow(
        [{ text: t("result_final_interference") }],
        [{ tex: `${formatNumber(fit.final_interference, 4)}\\,\\mathrm{mm}` }],
        { danger: fit.becomes_clearance }
      )
    );
    if (fit.becomes_clearance) {
      list.append(
        resultRow(
          [{ text: t("result_becomes_clearance") }],
          [{ tex: `${formatNumber(fit.final_clearance, 4)}\\,\\mathrm{mm}` }],
          { danger: true }
        )
      );
    }
  }

  if (calcMode === "professional" && outputs.interference_margin != null) {
    list.append(
      resultRow(
        [{ text: t("result_recommended_max_delta_t") }],
        [{ text: `${formatNumber(outputs.recommended_max_delta_t, 1)} °C` }]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-thermal__error");
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

async function calculateThermal(panel, button) {
  const root = panel.querySelector(".mechbox-thermal");
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
        tool_id: "thermal_expansion",
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

export async function mountThermalExpansionWorkbench(panel) {
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
    "mechbox__workbench-panel--thermal"
  );
  panel.classList.add("mechbox__workbench-panel--thermal");

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
  root.className = "mechbox-thermal";

  const modes = document.createElement("div");
  modes.className = "mechbox-thermal__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-thermal__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-thermal__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-thermal__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-thermal__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const material1 = materialSelect("material");
  const alpha1Input = numberInput("alpha_micro", "11.5");
  material1.addEventListener("change", () => {
    alpha1Input.value = String(MATERIAL_ALPHA_MICRO[material1.value] ?? "");
  });

  const material2 = materialSelect("material2");
  const alpha2Input = numberInput("alpha2_micro", "11.5");
  material2.addEventListener("change", () => {
    alpha2Input.value = String(MATERIAL_ALPHA_MICRO[material2.value] ?? "");
  });

  const material2Row = fieldRow(
    document.createTextNode(t("material2")),
    material2,
    document.createTextNode("")
  );
  material2Row.dataset.calcShow = "full professional";

  const alpha2Row = fieldRow(
    mixedLabel([{ text: t("alpha2") }, { text: " " }, { tex: "\\alpha_2" }]),
    alpha2Input,
    document.createTextNode("×10⁻⁶")
  );
  alpha2Row.dataset.calcShow = "full professional";

  const shaftRow = fieldRow(
    mixedLabel([{ text: t("shaft_diameter") }, { text: " " }, { tex: "d_s" }]),
    numberInput("shaft_diameter_mm", "50"),
    document.createTextNode("mm")
  );
  shaftRow.dataset.calcShow = "full professional";

  const holeRow = fieldRow(
    mixedLabel([{ text: t("hole_diameter") }, { text: " " }, { tex: "d_h" }]),
    numberInput("hole_diameter_mm", "49.975"),
    document.createTextNode("mm")
  );
  holeRow.dataset.calcShow = "full professional";

  const assemblyRow = fieldRow(
    mixedLabel([{ text: t("assembly_delta_t") }, { text: " " }, { tex: "\\Delta T_{asm}" }]),
    numberInput("assembly_delta_t", "80"),
    document.createTextNode("°C")
  );
  assemblyRow.dataset.calcShow = "professional";

  const serviceRow = fieldRow(
    mixedLabel([{ text: t("service_delta_t") }, { text: " " }, { tex: "\\Delta T_{svc}" }]),
    numberInput("service_delta_t", "100"),
    document.createTextNode("°C")
  );
  serviceRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("material")),
      material1,
      document.createTextNode("")
    ),
    fieldRow(
      mixedLabel([{ text: t("length") }, { text: " " }, { tex: "L" }]),
      numberInput("length_mm", "100"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("delta_t") }, { text: " " }, { tex: "\\Delta T" }]),
      numberInput("delta_t", "100"),
      document.createTextNode("°C")
    ),
    fieldRow(
      mixedLabel([{ text: t("alpha1") }, { text: " " }, { tex: "\\alpha" }]),
      alpha1Input,
      document.createTextNode("×10⁻⁶")
    ),
    material2Row,
    alpha2Row,
    shaftRow,
    holeRow,
    assemblyRow,
    serviceRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-thermal__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateThermal(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-thermal__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-thermal__card mechbox-thermal__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-thermal__results-body";
  resultsBody.innerHTML = `<p class="mechbox-thermal__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
}
