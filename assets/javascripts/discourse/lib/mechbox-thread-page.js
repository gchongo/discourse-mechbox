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

const GRADES = ["4.6", "4.8", "5.6", "8.8", "10.9", "12.9"];
const CALC_MODES = ["simple", "full", "professional"];

function t(key, options) {
  return i18n(`mechbox.thread.${key}`, options);
}

function suggestedPitch(diameter) {
  return METRIC_THREAD_PITCH[Math.round(Number(diameter))] || 1.5;
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
  row.className = "mechbox-thread__field";

  const label = document.createElement("label");
  label.className = "mechbox-thread__label";
  label.append(labelEl);

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-thread__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-thread__unit";
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
  input.className = "mechbox__inputs mechbox-thread__input";
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

function syncDiameterHints(root) {
  const diameter =
    Number(root.querySelector('input[name="diameter_mm"]')?.value) || 12;
  const pitch = root.querySelector('input[name="pitch_mm"]');
  const hint = root.querySelector("[data-diameter-hint]");
  const dKm = root.querySelector('input[name="d_km"]');
  const engaged = root.querySelector('input[name="engaged_length_mm"]');

  if (hint) {
    hint.replaceChildren();
    hint.append(texNode(`\\mathrm{M}${diameter}`));
    typesetRoot(hint);
  }

  if (pitch && !pitch.dataset.userEdited) {
    pitch.value = String(suggestedPitch(diameter));
  }

  if (dKm && !dKm.dataset.userEdited) {
    dKm.value = String(Number((1.45 * diameter).toFixed(2)));
  }

  if (engaged && !engaged.dataset.userEdited) {
    engaged.value = String(Number((1.5 * diameter).toFixed(1)));
  }
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-thread__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "A_{s}=\\dfrac{\\pi}{4}(d-0.9382P)^{2}",
        "\\sigma=F/A_{s}",
        "T=\\mu d F/1000",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "A_{ext}=0.5\\pi d_{1} L_{e}",
        "A_{int}=0.5\\pi d_{2} L_{e}",
        "m_{eff,min}=k\\cdot d",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "T=F\\left(0.16P+0.58 d_{2}\\mu_{G}+0.5 D_{km}\\mu_{K}\\right)/1000",
        "\\eta=\\sigma/\\sigma_{allow}",
      ],
    });
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
  row.className = "mechbox-thread__result-row";
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
    diameter_mm: Number(root.querySelector('input[name="diameter_mm"]')?.value),
    pitch_mm: Number(root.querySelector('input[name="pitch_mm"]')?.value),
    grade: root.querySelector('select[name="grade"]')?.value || "8.8",
    axial_force_n: Number(
      root.querySelector('input[name="axial_force_n"]')?.value
    ),
    engaged_length_mm: Number(
      root.querySelector('input[name="engaged_length_mm"]')?.value
    ),
  };

  if (calcMode === "simple") {
    inputs.friction_coeff = Number(
      root.querySelector('input[name="friction_coeff"]')?.value
    );
  } else {
    inputs.nut_material =
      root.querySelector('select[name="nut_material"]')?.value || "steel";
  }

  if (calcMode === "professional") {
    inputs.mu_g = Number(root.querySelector('input[name="mu_g"]')?.value);
    inputs.mu_k = Number(root.querySelector('input[name="mu_k"]')?.value);
    inputs.d_km = Number(root.querySelector('input[name="d_km"]')?.value);
  }

  return inputs;
}


async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-thread__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-thread__status ${
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
  list.className = "mechbox-thread__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_stress_area")} ` }, { tex: "A_{s}" }],
      [
        {
          tex: `${formatNumber(outputs.stress_area_mm2)}\\,\\mathrm{mm}^{2}`,
        },
      ]
    ),
    resultRow(
      [{ text: t("result_diameters") }],
      [
        {
          tex: `${formatNumber(outputs.pitch_diameter_mm, 3)}/${formatNumber(outputs.minor_diameter_mm, 3)}\\,\\mathrm{mm}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("result_tensile")} ` }, { tex: "\\sigma" }],
      [
        {
          tex: `${formatNumber(outputs.tensile_stress_mpa, 1)}\\,\\mathrm{MPa}`,
        },
      ],
      { danger: outputs.tensile_pass === false }
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
      [{ text: `${t("result_torque")} ` }, { tex: "T" }],
      [
        {
          tex: `${formatNumber(outputs.tightening_torque_nm)}\\,\\mathrm{N\\cdot m}`,
        },
        {
          text: ` (${t(`torque_${outputs.torque_method}`)})`,
        },
      ]
    ),
    resultRow(
      [{ text: t("result_max_force") }],
      [
        {
          tex: `${formatNumber(outputs.max_allowable_force_n, 0)}\\,\\mathrm{N}`,
        },
      ]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_min_engagement") }],
        [
          {
            tex: `${formatNumber(outputs.min_engagement_mm, 1)}\\,\\mathrm{mm}`,
          },
        ],
        { danger: outputs.engagement_pass === false }
      ),
      resultRow(
        [{ text: t("result_critical_side") }],
        [{ text: t(`side_${outputs.critical_shear_side}`) }]
      )
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_utilization") }],
        [
          {
            tex: `${formatNumber(Number(outputs.utilization) * 100, 1)}\\%`,
          },
        ]
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setThreadError(panel, message) {
  const error = panel.querySelector(".mechbox-thread__error");
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

async function calculateThread(panel, button) {
  const root = panel.querySelector(".mechbox-thread");
  if (!root) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setThreadError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "thread",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    await renderResults(panel, result);
  } catch (error) {
    if (error.jqXHR?.responseJSON?.errors?.length) {
      setThreadError(panel, error.jqXHR.responseJSON.errors.join(" "));
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function mountThreadWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  await ensureKatex();

  panel.classList.remove(
    "mechbox__workbench-panel--bolt",
    "mechbox__workbench-panel--units",
    "mechbox__workbench-panel--rss",
    "mechbox__workbench-panel--gdt"
  );
  panel.classList.add("mechbox__workbench-panel--thread");

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
  root.className = "mechbox-thread";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-thread__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-thread__mode-tab";
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
  formulaBar.className = "mechbox-thread__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-thread__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-thread__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const diameterInput = numberInput("diameter_mm", "12");
  diameterInput.addEventListener("input", () => syncDiameterHints(root));

  const pitchInput = numberInput("pitch_mm", "1.75");
  markUserEdited(pitchInput);

  const gradeSelect = document.createElement("select");
  gradeSelect.className = "mechbox-thread__select";
  gradeSelect.name = "grade";
  GRADES.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    if (g === "8.8") {
      opt.selected = true;
    }
    gradeSelect.append(opt);
  });

  const forceInput = numberInput("axial_force_n", "25000");
  const engagedInput = numberInput("engaged_length_mm", "18");
  markUserEdited(engagedInput);

  const frictionInput = numberInput("friction_coeff", "0.2");
  const frictionRow = fieldRow(
    mixedLabel([{ text: t("friction_coeff") }, { text: " " }, { tex: "\\mu" }]),
    frictionInput,
    document.createTextNode("—")
  );
  frictionRow.dataset.calcShow = "simple";

  const nutSelect = document.createElement("select");
  nutSelect.className = "mechbox-thread__select";
  nutSelect.name = "nut_material";
  [
    ["steel", t("nut_steel")],
    ["soft", t("nut_soft")],
  ].forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    nutSelect.append(opt);
  });
  const nutRow = fieldRow(
    document.createTextNode(t("nut_material")),
    nutSelect,
    document.createTextNode("—")
  );
  nutRow.dataset.calcShow = "full professional";

  const muGInput = numberInput("mu_g", "0.12");
  const muKInput = numberInput("mu_k", "0.12");
  const dKmInput = numberInput("d_km", "17.4");
  markUserEdited(dKmInput);

  const muGRow = fieldRow(
    mixedLabel([{ text: t("mu_g") }, { text: " " }, { tex: "\\mu_{G}" }]),
    muGInput,
    document.createTextNode("—")
  );
  muGRow.dataset.calcShow = "professional";

  const muKRow = fieldRow(
    mixedLabel([{ text: t("mu_k") }, { text: " " }, { tex: "\\mu_{K}" }]),
    muKInput,
    document.createTextNode("—")
  );
  muKRow.dataset.calcShow = "professional";

  const dKmRow = fieldRow(
    mixedLabel([{ text: t("d_km") }, { text: " " }, { tex: "D_{km}" }]),
    dKmInput,
    document.createTextNode("mm")
  );
  dKmRow.dataset.calcShow = "professional";

  const diameterHint = document.createElement("span");
  diameterHint.dataset.diameterHint = "true";

  inputsCard.append(
    fieldRow(
      mixedLabel([{ text: t("diameter") }, { text: " " }, { tex: "d" }]),
      diameterInput,
      diameterHint
    ),
    fieldRow(
      mixedLabel([{ text: t("pitch") }, { text: " " }, { tex: "P" }]),
      pitchInput,
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("grade")),
      gradeSelect,
      document.createTextNode("—")
    ),
    fieldRow(
      mixedLabel([{ text: t("axial_force") }, { text: " " }, { tex: "F" }]),
      forceInput,
      document.createTextNode("N")
    ),
    fieldRow(
      mixedLabel([
        { text: t("engaged_length") },
        { text: " " },
        { tex: "L_{e}" },
      ]),
      engagedInput,
      document.createTextNode("mm")
    ),
    frictionRow,
    nutRow,
    muGRow,
    muKRow,
    dKmRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-thread__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateThread(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-thread__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-thread__card mechbox-thread__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-thread__results-body";
  resultsBody.innerHTML = `<p class="mechbox-thread__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
  syncDiameterHints(root);
  await typesetRoot(root);

  panel.dataset.mounted = "true";
}
