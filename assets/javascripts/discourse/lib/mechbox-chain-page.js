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
  return i18n(`mechbox.chain.${key}`, options);
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
  row.className = "mechbox-chain__field";
  const label = document.createElement("label");
  label.className = "mechbox-chain__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-chain__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-chain__unit";
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
  input.className = "mechbox__inputs mechbox-chain__input";
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
  const bar = root.querySelector(".mechbox-chain__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "L_p=\\frac{2a}{p}+\\frac{z_1+z_2}{2}+\\frac{p(z_2-z_1)^2}{4\\pi^2 a}",
        "v=\\frac{p z_1 n}{60000},\\quad F=\\frac{P}{v\\eta}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["P_d=K_a P", "v\\le v_{\\max},\\quad F\\le [F]"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "F_{\\mathrm{strand}}=F/n_s",
        "L_h \\propto ([F]/F)^2 \\cdot K_{\\mathrm{lub}}",
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
  row.className = "mechbox-chain__result-row";
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
    pitch_mm: Number(root.querySelector('input[name="pitch_mm"]')?.value),
    driver_teeth: Number(root.querySelector('input[name="driver_teeth"]')?.value),
    driven_teeth: Number(root.querySelector('input[name="driven_teeth"]')?.value),
    center_distance_mm: Number(
      root.querySelector('input[name="center_distance_mm"]')?.value
    ),
    rpm: Number(root.querySelector('input[name="rpm"]')?.value),
    power_kw: Number(root.querySelector('input[name="power_kw"]')?.value),
  };

  if (calcMode === "full" || calcMode === "professional") {
    inputs.allow_tension_n = Number(
      root.querySelector('input[name="allow_tension_n"]')?.value
    );
    inputs.max_chain_speed_mps = Number(
      root.querySelector('input[name="max_chain_speed_mps"]')?.value
    );
  }

  if (calcMode === "professional") {
    inputs.service_factor = Number(
      root.querySelector('input[name="service_factor"]')?.value
    );
    inputs.strands = Number(root.querySelector('input[name="strands"]')?.value);
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-chain__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-chain__status ${
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
  list.className = "mechbox-chain__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_ratio")} ` }, { tex: "i" }],
      [{ text: formatNumber(outputs.ratio, 2) }]
    ),
    resultRow(
      [{ text: `${t("result_length")} ` }, { tex: "L" }],
      [{ tex: `${formatNumber(outputs.chain_length_mm, 0)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: t("result_links") }],
      [{ text: String(outputs.links ?? "—") }]
    ),
    resultRow(
      [{ text: `${t("result_speed")} ` }, { tex: "v" }],
      [{ tex: `${formatNumber(outputs.chain_speed_mps, 2)}\\,\\mathrm{m/s}` }],
      { danger: outputs.speed_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_tension")} ` }, { tex: "F" }],
      [{ tex: `${formatNumber(outputs.chain_tension_n, 0)}\\,\\mathrm{N}` }],
      { danger: outputs.tension_pass === false }
    ),
    resultRow(
      [{ text: t("result_driven_rpm") }],
      [{ tex: `${formatNumber(outputs.driven_rpm, 0)}\\,\\mathrm{rpm}` }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    if (outputs.tension_utilization != null) {
      list.append(
        resultRow(
          [{ text: t("result_utilization") }],
          [
            {
              tex: `${formatNumber(Number(outputs.tension_utilization) * 100, 1)}\\%`,
            },
          ]
        )
      );
    }
  }

  if (calcMode === "professional") {
    if (outputs.tension_per_strand_n != null) {
      list.append(
        resultRow(
          [{ text: t("result_tension_per_strand") }],
          [
            {
              tex: `${formatNumber(outputs.tension_per_strand_n, 0)}\\,\\mathrm{N}`,
            },
          ]
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

function setChainError(panel, message) {
  const error = panel.querySelector(".mechbox-chain__error");
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

async function calculateChain(panel, button) {
  const root = panel.querySelector(".mechbox-chain");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setChainError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "chain",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setChainError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountChainWorkbench(panel) {
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
    "mechbox__workbench-panel--clutch",
    "mechbox__workbench-panel--belt"
  );
  panel.classList.add("mechbox__workbench-panel--chain");

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
  root.className = "mechbox-chain";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-chain__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-chain__mode-tab";
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
  formulaBar.className = "mechbox-chain__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-chain__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-chain__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const allowRow = fieldRow(
    mixedLabel([{ text: t("allow_tension") }, { text: " " }, { tex: "[F]" }]),
    numberInput("allow_tension_n", "20000"),
    document.createTextNode("N")
  );
  allowRow.dataset.calcShow = "full professional";

  const maxSpeedRow = fieldRow(
    mixedLabel([{ text: t("max_chain_speed") }, { text: " " }, { tex: "v_{\\max}" }]),
    numberInput("max_chain_speed_mps", "15"),
    document.createTextNode("m/s")
  );
  maxSpeedRow.dataset.calcShow = "full professional";

  const serviceRow = fieldRow(
    mixedLabel([{ text: t("service_factor") }, { text: " " }, { tex: "K_a" }]),
    numberInput("service_factor", "1.3"),
    document.createTextNode("—")
  );
  serviceRow.dataset.calcShow = "professional";

  const strandsRow = fieldRow(
    document.createTextNode(t("strands")),
    numberInput("strands", "1"),
    document.createTextNode(t("strands_unit"))
  );
  strandsRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("pitch") }, { text: " " }, { tex: "p" }]),
      numberInput("pitch_mm", "15.875"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("driver_teeth") }, { text: " " }, { tex: "z_1" }]),
      numberInput("driver_teeth", "19"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("driven_teeth") }, { text: " " }, { tex: "z_2" }]),
      numberInput("driven_teeth", "57"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("center_distance") }, { text: " " }, { tex: "a" }]),
      numberInput("center_distance_mm", "500"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("rpm") }, { text: " " }, { tex: "n_1" }]),
      numberInput("rpm", "720"),
      document.createTextNode("rpm")
    ),
    fieldRow(
      mixedLabel([{ text: t("power") }, { text: " " }, { tex: "P" }]),
      numberInput("power_kw", "7.5"),
      document.createTextNode("kW")
    ),
    allowRow,
    maxSpeedRow,
    serviceRow,
    strandsRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-chain__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateChain(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-chain__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-chain__card mechbox-chain__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-chain__results-body";
  resultsBody.innerHTML = `<p class="mechbox-chain__results-empty">${t(
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
