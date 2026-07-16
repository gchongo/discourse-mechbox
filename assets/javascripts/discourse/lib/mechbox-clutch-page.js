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

function t(key, options) {
  return i18n(`mechbox.clutch.${key}`, options);
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
  row.className = "mechbox-clutch__field";
  const label = document.createElement("label");
  label.className = "mechbox-clutch__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-clutch__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-clutch__unit";
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
  input.className = "mechbox__inputs mechbox-clutch__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
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
  const bar = root.querySelector(".mechbox-clutch__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["T=\\mu F R n/1000", "P=\\frac{T\\cdot 2\\pi n}{60000}"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "R_{\\mathrm{eff}}=\\frac{2(R_o^3-R_i^3)}{3(R_o^2-R_i^2)}",
        "p=F/A",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "F_{\\mathrm{eff}}=\\max(0,F-F_{\\mathrm{cf}})",
        "T_{\\mathrm{der}}=\\mu F_{\\mathrm{eff}} R n \\cdot \\eta_{\\mathrm{th}}",
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
  row.className = "mechbox-clutch__result-row";
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
    friction_coeff: Number(
      root.querySelector('input[name="friction_coeff"]')?.value
    ),
    force_n: Number(root.querySelector('input[name="force_n"]')?.value),
    surfaces: Number(root.querySelector('input[name="surfaces"]')?.value),
    rpm: Number(root.querySelector('input[name="rpm"]')?.value),
  };

  if (calcMode === "simple") {
    inputs.radius_mm = Number(root.querySelector('input[name="radius_mm"]')?.value);
  } else {
    inputs.inner_diameter_mm = Number(
      root.querySelector('input[name="inner_diameter_mm"]')?.value
    );
    inputs.outer_diameter_mm = Number(
      root.querySelector('input[name="outer_diameter_mm"]')?.value
    );
  }

  if (calcMode === "professional") {
    inputs.required_torque_nm = Number(
      root.querySelector('input[name="required_torque_nm"]')?.value
    );
    inputs.thermal_fade = Number(
      root.querySelector('input[name="thermal_fade"]')?.value
    );
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-clutch__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-clutch__status ${
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
  list.className = "mechbox-clutch__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_torque")} ` }, { tex: "T" }],
      [{ tex: `${formatNumber(outputs.torque_nm, 2)}\\,\\mathrm{N\\cdot m}` }]
    ),
    resultRow(
      [{ text: t("result_power") }],
      [{ tex: `${formatNumber(outputs.power_kw, 2)}\\,\\mathrm{kW}` }]
    ),
    resultRow(
      [{ text: t("result_clamp_force") }],
      [{ tex: `${formatNumber(outputs.clamp_force_n, 0)}\\,\\mathrm{N}` }]
    )
  );

  if (outputs.effective_radius_mm != null) {
    list.append(
      resultRow(
        [{ text: t("result_effective_radius") }],
        [
          {
            tex: `${formatNumber(outputs.effective_radius_mm, 1)}\\,\\mathrm{mm}`,
          },
        ]
      )
    );
  }

  if (calcMode === "full" || calcMode === "professional") {
    if (outputs.contact_pressure_mpa != null) {
      list.append(
        resultRow(
          [{ text: t("result_contact_pressure") }],
          [
            {
              tex: `${formatNumber(outputs.contact_pressure_mpa, 3)}\\,\\mathrm{MPa}`,
            },
          ],
          { danger: outputs.pressure_pass === false }
        )
      );
    }
    if (outputs.utilization != null) {
      list.append(
        resultRow(
          [{ text: t("result_utilization") }],
          [{ tex: `${formatNumber(Number(outputs.utilization) * 100, 1)}\\%` }]
        )
      );
    }
  }

  if (calcMode === "professional" && outputs.derated_torque_nm != null) {
    list.append(
      resultRow(
        [{ text: t("result_derated_torque") }],
        [
          {
            tex: `${formatNumber(outputs.derated_torque_nm, 2)}\\,\\mathrm{N\\cdot m}`,
          },
        ],
        { danger: outputs.pass === false }
      )
    );
    if (outputs.centrifugal_force_n != null) {
      list.append(
        resultRow(
          [{ text: t("result_centrifugal") }],
          [
            {
              tex: `${formatNumber(outputs.centrifugal_force_n, 0)}\\,\\mathrm{N}`,
            },
          ]
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setClutchError(panel, message) {
  const error = panel.querySelector(".mechbox-clutch__error");
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

async function calculateClutch(panel, button) {
  const root = panel.querySelector(".mechbox-clutch");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setClutchError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "clutch",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setClutchError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountClutchWorkbench(panel) {
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
    "mechbox__workbench-panel--thread",
    "mechbox__workbench-panel--key",
    "mechbox__workbench-panel--bolt-group",
    "mechbox__workbench-panel--weld",
    "mechbox__workbench-panel--spring"
  );
  panel.classList.add("mechbox__workbench-panel--clutch");

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
  root.className = "mechbox-clutch";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-clutch__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-clutch__mode-tab";
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
  formulaBar.className = "mechbox-clutch__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-clutch__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-clutch__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const frictionInput = numberInput("friction_coeff", "0.15");
  const forceInput = numberInput("force_n", "5000");
  const radiusInput = numberInput("radius_mm", "80");
  const innerInput = numberInput("inner_diameter_mm", "100");
  const outerInput = numberInput("outer_diameter_mm", "160");
  const surfacesInput = numberInput("surfaces", "2");
  const rpmInput = numberInput("rpm", "1500");
  const requiredTorqueInput = numberInput("required_torque_nm", "100");
  const thermalFadeInput = numberInput("thermal_fade", "0.9");

  const radiusRow = fieldRow(
    mixedLabel([{ text: t("radius") }, { text: " " }, { tex: "R" }]),
    radiusInput,
    document.createTextNode("mm")
  );
  radiusRow.dataset.calcShow = "simple";

  const diamRow = document.createElement("div");
  diamRow.className = "mechbox-clutch__field";
  diamRow.dataset.calcShow = "full professional";
  const diamLabel = document.createElement("label");
  diamLabel.className = "mechbox-clutch__label";
  diamLabel.textContent = t("inner_outer_diam");
  const diamControl = document.createElement("div");
  diamControl.className = "mechbox-clutch__control mechbox-clutch__control--pair";
  diamControl.append(innerInput, outerInput);
  const diamUnit = document.createElement("span");
  diamUnit.className = "mechbox-clutch__unit";
  diamUnit.textContent = "mm";
  diamRow.append(diamLabel, diamControl, diamUnit);

  const requiredRow = fieldRow(
    mixedLabel([{ text: t("required_torque") }, { text: " " }, { tex: "T_{\\mathrm{req}}" }]),
    requiredTorqueInput,
    document.createTextNode("N·m")
  );
  requiredRow.dataset.calcShow = "professional";

  const thermalRow = fieldRow(
    mixedLabel([{ text: t("thermal_fade") }, { text: " " }, { tex: "\\eta_{\\mathrm{th}}" }]),
    thermalFadeInput,
    document.createTextNode("—")
  );
  thermalRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("friction_coeff") }, { text: " " }, { tex: "\\mu" }]),
      frictionInput,
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("clamp_force") }, { text: " " }, { tex: "F" }]),
      forceInput,
      document.createTextNode("N")
    ),
    radiusRow,
    diamRow,
    fieldRow(
      mixedLabel([{ text: t("surfaces") }, { text: " " }, { tex: "n" }]),
      surfacesInput,
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("rpm") }, { text: " " }, { tex: "n" }]),
      rpmInput,
      document.createTextNode("rpm")
    ),
    requiredRow,
    thermalRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-clutch__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateClutch(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-clutch__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-clutch__card mechbox-clutch__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-clutch__results-body";
  resultsBody.innerHTML = `<p class="mechbox-clutch__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}