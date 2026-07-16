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
  return i18n(`mechbox.belt.${key}`, options);
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
  row.className = "mechbox-belt__field";
  const label = document.createElement("label");
  label.className = "mechbox-belt__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-belt__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-belt__unit";
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
  input.className = "mechbox__inputs mechbox-belt__input";
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
  const bar = root.querySelector(".mechbox-belt__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "L=2C+\\frac{\\pi(D_1+D_2)}{2}+\\frac{(D_2-D_1)^2}{4C}",
        "F=\\frac{P}{v\\eta},\\quad F_1=F_2 e^{\\mu\\theta}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "\\theta=180^\\circ-2\\arcsin\\!\\left(\\frac{D_2-D_1}{2C}\\right)",
        "v=\\frac{\\pi D_1 n}{60000}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "P_d=K_a P,\\quad z=\\left\\lceil\\frac{K_a P}{P_b}\\right\\rceil",
        "\\sigma_b=F_1/A_b",
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
  row.className = "mechbox-belt__result-row";
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
    driver_diameter_mm: Number(
      root.querySelector('input[name="driver_diameter_mm"]')?.value
    ),
    driven_diameter_mm: Number(
      root.querySelector('input[name="driven_diameter_mm"]')?.value
    ),
    center_distance_mm: Number(
      root.querySelector('input[name="center_distance_mm"]')?.value
    ),
    rpm: Number(root.querySelector('input[name="rpm"]')?.value),
    power_kw: Number(root.querySelector('input[name="power_kw"]')?.value),
  };

  if (calcMode === "simple") {
    inputs.wrap_angle_deg = Number(
      root.querySelector('input[name="wrap_angle_deg"]')?.value
    );
  }

  if (calcMode === "full" || calcMode === "professional") {
    inputs.power_per_belt_kw = Number(
      root.querySelector('input[name="power_per_belt_kw"]')?.value
    );
    inputs.max_belt_speed_mps = Number(
      root.querySelector('input[name="max_belt_speed_mps"]')?.value
    );
  }

  if (calcMode === "professional") {
    inputs.service_factor = Number(
      root.querySelector('input[name="service_factor"]')?.value
    );
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-belt__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-belt__status ${
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
  list.className = "mechbox-belt__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_ratio")} ` }, { tex: "i" }],
      [{ text: formatNumber(outputs.ratio, 2) }]
    ),
    resultRow(
      [{ text: `${t("result_length")} ` }, { tex: "L" }],
      [{ tex: `${formatNumber(outputs.belt_length_mm, 0)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: t("result_speed_wrap") }],
      [
        {
          tex: `${formatNumber(outputs.belt_speed_mps, 2)}\\,\\mathrm{m/s}\\;/\\;${formatNumber(outputs.wrap_angle_deg, 1)}^\\circ`,
        },
      ],
      { danger: outputs.speed_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_tight")} ` }, { tex: "F_1" }],
      [{ tex: `${formatNumber(outputs.tight_side_force_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_slack")} ` }, { tex: "F_2" }],
      [{ tex: `${formatNumber(outputs.slack_side_force_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: t("result_driven_rpm") }],
      [{ tex: `${formatNumber(outputs.driven_rpm, 0)}\\,\\mathrm{rpm}` }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    if (outputs.belt_count != null) {
      list.append(
        resultRow(
          [{ text: t("result_belt_count") }],
          [{ text: `${outputs.belt_count} ${t("belt_count_unit")}` }]
        )
      );
    }
    if (outputs.power_per_belt_kw != null) {
      list.append(
        resultRow(
          [{ text: t("result_power_per_belt") }],
          [
            {
              tex: `${formatNumber(outputs.power_per_belt_kw, 1)}\\,\\mathrm{kW}`,
            },
          ]
        )
      );
    }
  }

  if (calcMode === "professional") {
    if (outputs.flex_stress_n_per_mm2 != null) {
      list.append(
        resultRow(
          [{ text: t("result_flex_stress") }],
          [
            {
              tex: `${formatNumber(outputs.flex_stress_n_per_mm2, 1)}\\,\\mathrm{N/mm^2}`,
            },
          ],
          { danger: outputs.flex_pass === false }
        )
      );
    }
    if (outputs.estimated_life_hours != null) {
      list.append(
        resultRow(
          [{ text: t("result_life_hours") }],
          [
            {
              text: `${Math.round(Number(outputs.estimated_life_hours)).toLocaleString()} h`,
            },
          ]
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setBeltError(panel, message) {
  const error = panel.querySelector(".mechbox-belt__error");
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

async function calculateBelt(panel, button) {
  const root = panel.querySelector(".mechbox-belt");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setBeltError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "belt",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setBeltError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountBeltWorkbench(panel) {
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
    "mechbox__workbench-panel--spring",
    "mechbox__workbench-panel--clutch"
  );
  panel.classList.add("mechbox__workbench-panel--belt");

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
  root.className = "mechbox-belt";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-belt__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-belt__mode-tab";
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
  formulaBar.className = "mechbox-belt__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-belt__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-belt__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const wrapRow = fieldRow(
    mixedLabel([{ text: t("wrap_angle") }, { text: " " }, { tex: "\\theta" }]),
    numberInput("wrap_angle_deg", "180"),
    document.createTextNode("°")
  );
  wrapRow.dataset.calcShow = "simple";

  const powerPerBeltRow = fieldRow(
    mixedLabel([{ text: t("power_per_belt") }, { text: " " }, { tex: "P_b" }]),
    numberInput("power_per_belt_kw", "2.5"),
    document.createTextNode("kW")
  );
  powerPerBeltRow.dataset.calcShow = "full professional";

  const maxSpeedRow = fieldRow(
    mixedLabel([{ text: t("max_belt_speed") }, { text: " " }, { tex: "v_{\\max}" }]),
    numberInput("max_belt_speed_mps", "30"),
    document.createTextNode("m/s")
  );
  maxSpeedRow.dataset.calcShow = "full professional";

  const serviceRow = fieldRow(
    mixedLabel([{ text: t("service_factor") }, { text: " " }, { tex: "K_a" }]),
    numberInput("service_factor", "1.2"),
    document.createTextNode("—")
  );
  serviceRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("driver_diameter") }, { text: " " }, { tex: "D_1" }]),
      numberInput("driver_diameter_mm", "120"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("driven_diameter") }, { text: " " }, { tex: "D_2" }]),
      numberInput("driven_diameter_mm", "300"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("center_distance") }, { text: " " }, { tex: "C" }]),
      numberInput("center_distance_mm", "500"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("rpm") }, { text: " " }, { tex: "n_1" }]),
      numberInput("rpm", "1450"),
      document.createTextNode("rpm")
    ),
    fieldRow(
      mixedLabel([{ text: t("power") }, { text: " " }, { tex: "P" }]),
      numberInput("power_kw", "5.5"),
      document.createTextNode("kW")
    ),
    wrapRow,
    powerPerBeltRow,
    maxSpeedRow,
    serviceRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-belt__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateBelt(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-belt__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-belt__card mechbox-belt__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-belt__results-body";
  resultsBody.innerHTML = `<p class="mechbox-belt__results-empty">${t(
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
