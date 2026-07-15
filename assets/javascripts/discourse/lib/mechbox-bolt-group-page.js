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

const CALC_MODES = ["simple", "full", "professional"];

function t(key, options) {
  return i18n(`mechbox.bolt_group.${key}`, options);
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
  row.className = "mechbox-bolt-group__field";

  const label = document.createElement("label");
  label.className = "mechbox-bolt-group__label";
  label.append(labelEl);

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-bolt-group__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-bolt-group__unit";
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
  input.className = "mechbox__inputs mechbox-bolt-group__input";
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

function syncCalcModeVisibility(root) {
  const calcMode = getCalcMode(root);
  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });
}

function modeTabLabel(mode) {
  if (mode === "full") {
    return t("mode_full");
  }
  if (mode === "professional") {
    return t("mode_professional");
  }
  return t("mode_simple");
}

function syncFormulaBar(root) {
  const mode = getCalcMode(root);
  const bar = root.querySelector(".mechbox-bolt-group__formula-bar");
  if (!bar) {
    return;
  }

  if (mode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "F_{ix} = \\frac{F_x}{n} - \\frac{M y_i}{I_p},\\quad F_{iy} = \\frac{F_y}{n} + \\frac{M x_i}{I_p}",
      ],
    });
  } else if (mode === "professional") {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "F_{\\mathrm{comb}} = \\sqrt{V^2+T^2},\\quad F_{\\mathrm{slip}}=\\mu\\sum F_{\\mathrm{clamp}}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "F_{\\max} \\approx \\frac{\\sqrt{F_x^2+F_y^2}}{n} + \\frac{M r_{\\max}}{J}",
      ],
    });
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  root.querySelectorAll(".mechbox-bolt-group__mode-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.calcMode === mode);
  });
  syncCalcModeVisibility(root);
  syncFormulaBar(root);
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-bolt-group__result-row";
  if (options.danger) {
    row.classList.add("is-danger");
  }

  const dt = document.createElement("dt");
  labelParts.forEach((part) => {
    if (part.tex) {
      dt.append(texNode(part.tex));
    } else {
      dt.append(document.createTextNode(part.text || ""));
    }
  });

  const dd = document.createElement("dd");
  valueParts.forEach((part) => {
    if (part.tex) {
      dd.append(texNode(part.tex, { displayMode: false }));
    } else {
      dd.append(document.createTextNode(part.text || ""));
    }
  });

  row.append(dt, dd);
  return row;
}

function readInputs(root) {
  const mode = getCalcMode(root);
  const num = (name) =>
    Number(root.querySelector(`input[name="${name}"]`)?.value);

  const inputs = {
    calc_mode: mode,
    bolt_count: num("bolt_count"),
    bolt_circle_radius_mm: num("bolt_circle_radius_mm"),
    shear_x_n: num("shear_x_n"),
    shear_y_n: num("shear_y_n"),
    moment_nmm: num("moment_nmm"),
    allow_per_bolt_n: num("allow_per_bolt_n"),
  };

  if (mode === "full" || mode === "professional") {
    inputs.friction_coeff = num("friction_coeff");
    inputs.clamp_force_per_bolt_n = num("clamp_force_per_bolt_n");
    inputs.axial_tension_n = num("axial_tension_n");
    inputs.prying_arm_mm = num("prying_arm_mm");
    inputs.allow_tension_per_bolt_n = num("allow_tension_per_bolt_n");
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-bolt-group__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-bolt-group__status ${
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
  list.className = "mechbox-bolt-group__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_direct")} ` }, { tex: "F/n" }],
      [{ tex: `${formatNumber(outputs.direct_per_bolt_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_torsion")} ` }, { tex: "F_M" }],
      [{ tex: `${formatNumber(outputs.torsion_per_bolt_n, 0)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_max_force")} ` }, { tex: "F_{\\max}" }],
      [
        {
          tex: `${formatNumber(outputs.max_bolt_force_n, 0)}\\,\\mathrm{N}`,
        },
      ],
      {
        danger:
          outputs.force_pass === false ||
          (!outputs.estimate_only && outputs.pass === false),
      }
    ),
    resultRow(
      [{ text: t("result_allow") }],
      [
        {
          tex: `${formatNumber(outputs.allow_per_bolt_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    )
  );

  if (outputs.critical_bolt_index) {
    list.append(
      resultRow(
        [{ text: t("result_critical") }],
        [{ text: `#${outputs.critical_bolt_index}` }]
      )
    );
  }

  if (outputs.friction) {
    list.append(
      resultRow(
        [{ text: t("result_slip_capacity") }],
        [
          {
            tex: `${formatNumber(outputs.friction.slip_capacity_n, 0)}\\,\\mathrm{N}`,
          },
        ]
      ),
      resultRow(
        [{ text: t("result_slip_pass") }],
        [
          {
            text: outputs.friction.slip_pass
              ? t("status_pass")
              : t("status_attention"),
          },
        ],
        { danger: !outputs.friction.slip_pass }
      )
    );
  }

  if (outputs.prying?.prying_tension_n > 0) {
    list.append(
      resultRow(
        [{ text: t("result_prying") }],
        [
          {
            tex: `${formatNumber(outputs.prying.prying_tension_n, 0)}\\,\\mathrm{N}`,
          },
        ]
      )
    );
  }

  box.append(list);

  if (calcMode === "full" || calcMode === "professional") {
    renderBoltTable(box, outputs.bolts);
  }

  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-bolt-group__error");
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

async function calculateBoltGroup(panel, button) {
  const root = panel.querySelector(".mechbox-bolt-group");
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
        tool_id: "bolt_group",
        save_record: false,
        inputs: readInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    const message =
      error?.jqXHR?.responseJSON?.errors?.[0] ||
      error?.jqXHR?.responseJSON?.error;
    if (message) {
      setError(panel, message);
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountBoltGroupWorkbench(panel) {
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
    "mechbox__workbench-panel--bolt-group"
  );
  panel.classList.add("mechbox__workbench-panel--bolt-group");

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
  root.className = "mechbox-bolt-group";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-bolt-group__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-bolt-group__mode-tab";
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
  formulaBar.className = "mechbox-bolt-group__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-bolt-group__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-bolt-group__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const allowRow = fieldRow(
    mixedLabel([{ text: t("allow_per_bolt") }, { text: " " }, { tex: "[F]" }]),
    numberInput("allow_per_bolt_n", "8000"),
    document.createTextNode("N")
  );

  const frictionRow = fieldRow(
    mixedLabel([{ text: t("friction_coeff") }, { text: " " }, { tex: "\\mu" }]),
    numberInput("friction_coeff", "0.2"),
    document.createTextNode("—")
  );
  frictionRow.dataset.calcShow = "full professional";

  const clampRow = fieldRow(
    mixedLabel([
      { text: t("clamp_force") },
      { text: " " },
      { tex: "F_{\\mathrm{clamp}}" },
    ]),
    numberInput("clamp_force_per_bolt_n", "25000"),
    document.createTextNode("N")
  );
  clampRow.dataset.calcShow = "full professional";

  const axialRow = fieldRow(
    mixedLabel([{ text: t("axial_tension") }, { text: " " }, { tex: "F_a" }]),
    numberInput("axial_tension_n", "0"),
    document.createTextNode("N")
  );
  axialRow.dataset.calcShow = "full professional";

  const pryingRow = fieldRow(
    mixedLabel([{ text: t("prying_arm") }, { text: " " }, { tex: "a" }]),
    numberInput("prying_arm_mm", "40"),
    document.createTextNode("mm")
  );
  pryingRow.dataset.calcShow = "full professional";

  const allowTensionRow = fieldRow(
    mixedLabel([
      { text: t("allow_tension") },
      { text: " " },
      { tex: "[F_t]" },
    ]),
    numberInput("allow_tension_per_bolt_n", "8000"),
    document.createTextNode("N")
  );
  allowTensionRow.dataset.calcShow = "full professional";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("bolt_count") }, { text: " " }, { tex: "n" }]),
      numberInput("bolt_count", "8"),
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([
        { text: t("bolt_circle_radius") },
        { text: " " },
        { tex: "R" },
      ]),
      numberInput("bolt_circle_radius_mm", "60"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("shear_x") }, { text: " " }, { tex: "F_x" }]),
      numberInput("shear_x_n", "5000"),
      document.createTextNode("N")
    ),
    fieldRow(
      mixedLabel([{ text: t("shear_y") }, { text: " " }, { tex: "F_y" }]),
      numberInput("shear_y_n", "2000"),
      document.createTextNode("N")
    ),
    fieldRow(
      mixedLabel([{ text: t("moment") }, { text: " " }, { tex: "M" }]),
      numberInput("moment_nmm", "120000"),
      document.createTextNode("N·mm")
    ),
    allowRow,
    frictionRow,
    clampRow,
    axialRow,
    pryingRow,
    allowTensionRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-bolt-group__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateBoltGroup(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-bolt-group__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-bolt-group__card mechbox-bolt-group__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-bolt-group__results-body";
  resultsBody.innerHTML = `<p class="mechbox-bolt-group__results-empty">${t(
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
