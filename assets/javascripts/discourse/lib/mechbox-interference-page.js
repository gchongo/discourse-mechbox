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
  return i18n(`mechbox.interference_fit.${key}`, options);
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
  row.className = "mechbox-interference__field";
  const label = document.createElement("label");
  label.className = "mechbox-interference__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-interference__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-interference__unit";
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
  input.className = "mechbox__inputs mechbox-interference__input";
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
  const bar = root.querySelector(".mechbox-interference__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "p=\\delta_r/[r_i(\\lambda_h+\\lambda_s)]",
        "F=p\\,\\pi d L(\\mu+0.02)",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\sigma_{\\theta,h}=p\\frac{r_o^2+r_i^2}{r_o^2-r_i^2}",
        "T=\\tfrac12 p\\,\\pi d^2 L\\mu",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "i_{\\mathrm{hot}}=i_0+(\\alpha_s d_s-\\alpha_h d_h)\\Delta T",
        "p=f(i_{\\mathrm{hot}})",
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
  syncInterferenceDisplay(root);
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
  row.className = "mechbox-interference__result-row";
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

function syncInterferenceDisplay(root) {
  const shaft = Number(root.querySelector('input[name="shaft_diameter_mm"]')?.value);
  const hole = Number(root.querySelector('input[name="hole_diameter_mm"]')?.value);
  const el = root.querySelector("[data-interference-display]");
  if (!el || !Number.isFinite(shaft) || !Number.isFinite(hole)) {
    return;
  }
  el.textContent = `${formatNumber(shaft - hole, 3)} mm`;
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    shaft_diameter_mm: Number(
      root.querySelector('input[name="shaft_diameter_mm"]')?.value
    ),
    hole_diameter_mm: Number(
      root.querySelector('input[name="hole_diameter_mm"]')?.value
    ),
    hub_outer_diameter_mm: Number(
      root.querySelector('input[name="hub_outer_diameter_mm"]')?.value
    ),
    fit_length_mm: Number(root.querySelector('input[name="fit_length_mm"]')?.value),
    friction: Number(root.querySelector('input[name="friction"]')?.value),
    shaft_e_mpa: Number(root.querySelector('input[name="shaft_e_mpa"]')?.value),
    hub_e_mpa: Number(root.querySelector('input[name="hub_e_mpa"]')?.value),
    shaft_nu: Number(root.querySelector('input[name="shaft_nu"]')?.value),
    hub_nu: Number(root.querySelector('input[name="hub_nu"]')?.value),
  };

  if (calcMode === "full" || calcMode === "professional") {
    const inner = root.querySelector('input[name="shaft_inner_diameter_mm"]')?.value;
    if (inner !== undefined && inner !== "") {
      inputs.shaft_inner_diameter_mm = Number(inner);
    }
    const shaftAllow = root.querySelector('input[name="shaft_allow_hoop_mpa"]')?.value;
    const hubAllow = root.querySelector('input[name="hub_allow_hoop_mpa"]')?.value;
    if (shaftAllow) {
      inputs.shaft_allow_hoop_mpa = Number(shaftAllow);
    }
    if (hubAllow) {
      inputs.hub_allow_hoop_mpa = Number(hubAllow);
    }
  }

  if (calcMode === "professional") {
    const deltaT = root.querySelector('input[name="delta_t"]')?.value;
    if (deltaT !== undefined && deltaT !== "") {
      inputs.delta_t = Number(deltaT);
    }
    const shaftAlpha = root.querySelector('input[name="shaft_alpha_micro"]')?.value;
    const holeAlpha = root.querySelector('input[name="hole_alpha_micro"]')?.value;
    if (shaftAlpha) {
      inputs.shaft_alpha_micro = Number(shaftAlpha);
    }
    if (holeAlpha) {
      inputs.hole_alpha_micro = Number(holeAlpha);
    }
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-interference__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  if (outputs.error_key === "clearance_after_thermal") {
    const status = document.createElement("div");
    status.className = "mechbox-interference__status is-attention";
    status.textContent = `${t("overall")}: ${t("status_clearance")}`;
    box.append(status);
    const list = document.createElement("dl");
    list.className = "mechbox-interference__result-list";
    list.append(
      resultRow(
        [{ text: t("result_interference") }],
        [{ tex: `${formatNumber(outputs.interference, 4)}\\,\\mathrm{mm}` }],
        { danger: true }
      )
    );
    box.append(list);
    await typesetRoot(box);
    return;
  }

  const status = document.createElement("div");
  status.className = `mechbox-interference__status ${
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
  list.className = "mechbox-interference__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_interference")} ` }, { tex: "i" }],
      [{ tex: `${formatNumber(outputs.interference, 4)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: `${t("result_pressure")} ` }, { tex: "p" }],
      [{ tex: `${formatNumber(outputs.pressure, 1)}\\,\\mathrm{MPa}` }]
    ),
    resultRow(
      [{ text: t("result_hoop") }],
      [
        {
          tex: `${formatNumber(outputs.hoop_hub, 1)}/${formatNumber(
            outputs.hoop_shaft,
            1
          )}\\,\\mathrm{MPa}`,
        },
      ],
      { danger: outputs.hoop_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_press_force")} ` }, { tex: "F" }],
      [{ tex: `${formatNumber(outputs.press_force, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_torque")} ` }, { tex: "T" }],
      [{ tex: `${formatNumber(outputs.torque_capacity_nm, 1)}\\,\\mathrm{N\\cdot m}` }]
    ),
    resultRow(
      [{ text: t("result_min_wall") }],
      [{ tex: `${formatNumber(outputs.min_hub_wall, 2)}\\,\\mathrm{mm}` }],
      { danger: !!outputs.thin_wall_warning }
    )
  );

  if ((calcMode === "full" || calcMode === "professional") && outputs.hollow_shaft) {
    list.append(
      resultRow([{ text: t("result_hollow_shaft") }], [{ text: t("yes") }])
    );
  }

  if (calcMode === "professional" && outputs.thermal) {
    list.append(
      resultRow(
        [{ text: t("result_thermal_change") }],
        [
          {
            tex: `${formatNumber(
              outputs.thermal.interference_change,
              4
            )}\\,\\mathrm{mm}`,
          },
        ]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-interference__error");
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

async function calculateInterference(panel, button) {
  const root = panel.querySelector(".mechbox-interference");
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
        tool_id: "interference_fit",
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

export async function mountInterferenceFitWorkbench(panel) {
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
    "mechbox__workbench-panel--interference"
  );
  panel.classList.add("mechbox__workbench-panel--interference");

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
  root.className = "mechbox-interference";

  const modes = document.createElement("div");
  modes.className = "mechbox-interference__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-interference__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-interference__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-interference__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-interference__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const shaftInput = numberInput("shaft_diameter_mm", "50");
  const holeInput = numberInput("hole_diameter_mm", "49.975");
  shaftInput.addEventListener("input", () => syncInterferenceDisplay(root));
  holeInput.addEventListener("input", () => syncInterferenceDisplay(root));

  const interferenceDisplay = document.createElement("span");
  interferenceDisplay.className = "mechbox-interference__readonly";
  interferenceDisplay.dataset.interferenceDisplay = "true";
  interferenceDisplay.textContent = "0.025 mm";

  const shaftInnerRow = fieldRow(
    mixedLabel([{ text: t("shaft_inner") }, { text: " " }, { tex: "d_{i}" }]),
    numberInput("shaft_inner_diameter_mm", "0"),
    document.createTextNode("mm")
  );
  shaftInnerRow.dataset.calcShow = "full professional";

  const allowShaft = numberInput("shaft_allow_hoop_mpa", "350");
  const allowHub = numberInput("hub_allow_hoop_mpa", "350");
  const allowWrap = document.createElement("div");
  allowWrap.className = "mechbox-interference__control--pair";
  allowWrap.append(allowShaft, allowHub);
  const allowRow = fieldRow(
    document.createTextNode(t("allow_hoop")),
    allowWrap,
    document.createTextNode("MPa")
  );
  allowRow.dataset.calcShow = "full professional";

  const deltaRow = fieldRow(
    mixedLabel([{ text: t("delta_t") }, { text: " " }, { tex: "\\Delta T" }]),
    numberInput("delta_t", "0"),
    document.createTextNode("°C")
  );
  deltaRow.dataset.calcShow = "professional";

  const alphaShaft = numberInput("shaft_alpha_micro", "11.5");
  const alphaHole = numberInput("hole_alpha_micro", "11.5");
  const alphaWrap = document.createElement("div");
  alphaWrap.className = "mechbox-interference__control--pair";
  alphaWrap.append(alphaShaft, alphaHole);
  const alphaRow = fieldRow(
    mixedLabel([{ text: t("alphas") }, { text: " " }, { tex: "\\alpha" }]),
    alphaWrap,
    document.createTextNode("×10⁻⁶")
  );
  alphaRow.dataset.calcShow = "professional";

  const hubOuterInput = numberInput("hub_outer_diameter_mm", "90");
  const recommendBtn = document.createElement("button");
  recommendBtn.type = "button";
  recommendBtn.className = "btn btn-flat mechbox-interference__recommend";
  recommendBtn.textContent = t("recommend_outer");
  recommendBtn.addEventListener("click", (event) => {
    event.preventDefault();
    const shaft = Number(shaftInput.value);
    if (Number.isFinite(shaft) && shaft > 0) {
      hubOuterInput.value = String(Math.round(shaft * 1.8));
    }
  });
  const hubOuterControl = document.createElement("div");
  hubOuterControl.className = "mechbox-interference__control--pair";
  hubOuterControl.append(hubOuterInput, recommendBtn);

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("shaft_diameter") }, { text: " " }, { tex: "d_s" }]),
      shaftInput,
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("hole_diameter") }, { text: " " }, { tex: "d_h" }]),
      holeInput,
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("interference") }, { text: " " }, { tex: "i" }]),
      interferenceDisplay,
      document.createTextNode("")
    ),
    shaftInnerRow,
    fieldRow(
      mixedLabel([{ text: t("hub_outer") }, { text: " " }, { tex: "D_o" }]),
      hubOuterControl,
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("fit_length") }, { text: " " }, { tex: "L" }]),
      numberInput("fit_length_mm", "40"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("friction") }, { text: " " }, { tex: "\\mu" }]),
      numberInput("friction", "0.12"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("shaft_e") }, { text: " " }, { tex: "E_s" }]),
      numberInput("shaft_e_mpa", "210000"),
      document.createTextNode("MPa")
    ),
    fieldRow(
      mixedLabel([{ text: t("hub_e") }, { text: " " }, { tex: "E_h" }]),
      numberInput("hub_e_mpa", "210000"),
      document.createTextNode("MPa")
    ),
    fieldRow(
      mixedLabel([{ text: t("shaft_nu") }, { text: " " }, { tex: "\\nu_s" }]),
      numberInput("shaft_nu", "0.3"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("hub_nu") }, { text: " " }, { tex: "\\nu_h" }]),
      numberInput("hub_nu", "0.3"),
      document.createTextNode("—")
    ),
    allowRow,
    deltaRow,
    alphaRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-interference__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateInterference(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-interference__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className =
    "mechbox-interference__card mechbox-interference__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-interference__results-body";
  resultsBody.innerHTML = `<p class="mechbox-interference__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
}
