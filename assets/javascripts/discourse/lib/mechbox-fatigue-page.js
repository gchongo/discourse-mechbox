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
  "steel_45",
  "steel_40cr",
  "spring_steel",
  "aluminum_6061",
  "cast_iron",
];

function t(key, options) {
  return i18n(`mechbox.fatigue.${key}`, options);
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function formatLife(outputs) {
  if (outputs.life_infinite) {
    return t("life_infinite");
  }
  if (outputs.life_cycles == null) {
    return "—";
  }
  return formatNumber(outputs.life_cycles, 0);
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-fatigue__field";
  const label = document.createElement("label");
  label.className = "mechbox-fatigue__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-fatigue__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-fatigue__unit";
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
  input.className = "mechbox__inputs mechbox-fatigue__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-fatigue__select";
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
  const bar = root.querySelector(".mechbox-fatigue__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["S_a=S_f' N^{b}", "N=(S_a/S_f')^{1/b}"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["D=\\sum n_i/N_{f,i}", "D<1"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "S_{a,\\mathrm{eff}}=S_a/(1-S_m/S_u)",
        "S_e'=k_a k_b S_e",
        "D=\\sum n_i/N_{f,i}",
      ],
    });
  }
  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    material: root.querySelector('select[name="material"]')?.value || "steel_45",
    stress_amplitude_mpa: Number(
      root.querySelector('input[name="stress_amplitude_mpa"]')?.value
    ),
  };

  if (calcMode !== "simple") {
    inputs.target_life = Number(
      root.querySelector('input[name="target_life"]')?.value || 1e6
    );
    const spectrum = root.querySelector('textarea[name="loads_json"]')?.value || "";
    if (spectrum.trim()) {
      inputs.loads_json = spectrum;
    }
  }

  if (calcMode === "professional") {
    inputs.mean_stress_mpa = Number(
      root.querySelector('input[name="mean_stress_mpa"]')?.value || 0
    );
    inputs.mean_stress_method =
      root.querySelector('select[name="mean_stress_method"]')?.value || "goodman";
    inputs.surface_factor = Number(
      root.querySelector('input[name="surface_factor"]')?.value || 1
    );
    inputs.size_factor = Number(
      root.querySelector('input[name="size_factor"]')?.value || 1
    );
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-fatigue__result-row";
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

function renderMinerTable(miner) {
  if (!miner?.details?.length) {
    return null;
  }

  const wrap = document.createElement("div");
  wrap.className = "mechbox-fatigue__miner";

  const heading = document.createElement("h4");
  heading.textContent = t("miner_title");
  wrap.append(heading);

  const table = document.createElement("table");
  table.className = "mechbox-fatigue__table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [t("col_sa"), t("col_n"), t("col_nf"), t("col_damage"), t("col_share")].forEach(
    (label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.append(th);
    }
  );
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  miner.details.forEach((row) => {
    const tr = document.createElement("tr");
    const nf = row.life_infinite
      ? "∞"
      : row.life_cycles != null
        ? formatNumber(row.life_cycles, 0)
        : "—";
    const dmg = row.damage_infinite
      ? "∞"
      : row.damage != null
        ? formatNumber(row.damage, 4)
        : "—";
    const share =
      row.contribution_pct != null ? `${formatNumber(row.contribution_pct, 1)}%` : "—";
    [
      formatNumber(row.stress_mpa, 1),
      formatNumber(row.cycles, 0),
      nf,
      dmg,
      share,
    ].forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-fatigue__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-fatigue__status ${
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
  list.className = "mechbox-fatigue__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_amplitude")} ` }, { tex: "S_a" }],
      [{ tex: `${formatNumber(outputs.stress_amplitude_mpa, 1)}\\,\\mathrm{MPa}` }]
    ),
    resultRow(
      [{ text: `${t("result_life")} ` }, { tex: "N" }],
      [{ text: formatLife(outputs) }],
      { danger: calcMode !== "simple" && outputs.single_level_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_endurance")} ` }, { tex: "S_e" }],
      [{ tex: `${formatNumber(outputs.endurance_limit_mpa, 1)}\\,\\mathrm{MPa}` }]
    )
  );

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: `${t("result_effective")} ` }, { tex: "S_{a,\\mathrm{eff}}" }],
        [{ tex: `${formatNumber(outputs.effective_amplitude_mpa, 1)}\\,\\mathrm{MPa}` }]
      ),
      resultRow(
        [{ text: `${t("result_adjusted")} ` }, { tex: "S_e'" }],
        [{ tex: `${formatNumber(outputs.adjusted_endurance_mpa, 1)}\\,\\mathrm{MPa}` }]
      )
    );
  }

  if (calcMode !== "simple" && outputs.miner) {
    const dText = outputs.miner.damage_infinite
      ? "∞"
      : formatNumber(outputs.miner.total_damage, 4);
    list.append(
      resultRow(
        [{ text: `${t("result_damage")} ` }, { tex: "D" }],
        [{ text: dText }],
        { danger: outputs.miner.pass === false }
      )
    );
  }

  box.append(list);

  if (calcMode !== "simple" && outputs.miner) {
    const table = renderMinerTable(outputs.miner);
    if (table) {
      box.append(table);
    }
  }

  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-fatigue__error");
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

async function calculateFatigue(panel, button) {
  const root = panel.querySelector(".mechbox-fatigue");
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
        tool_id: "fatigue",
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

export async function mountFatigueWorkbench(panel) {
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
    "mechbox__workbench-panel--interference",
    "mechbox__workbench-panel--bearing",
    "mechbox__workbench-panel--shaft",
    "mechbox__workbench-panel--gear-ratio",
    "mechbox__workbench-panel--gear",
    "mechbox__workbench-panel--fatigue"
  );
  panel.classList.add("mechbox__workbench-panel--fatigue");

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
  root.className = "mechbox-fatigue";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-fatigue__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-fatigue__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-fatigue__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-fatigue__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-fatigue__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const materialOptions = MATERIALS.map((id) => [id, t(`material_${id}`)]);
  inputsCard.append(
    fieldRow(
      document.createTextNode(t("material")),
      selectInput("material", materialOptions, "steel_45"),
      document.createTextNode("")
    ),
    fieldRow(
      document.createTextNode(t("stress_amplitude")),
      numberInput("stress_amplitude_mpa", "300"),
      document.createTextNode("MPa")
    )
  );

  const targetRow = fieldRow(
    document.createTextNode(t("target_life")),
    numberInput("target_life", "1000000"),
    document.createTextNode(t("unit_cycles"))
  );
  targetRow.dataset.calcShow = "full professional";
  inputsCard.append(targetRow);

  const meanRow = fieldRow(
    document.createTextNode(t("mean_stress")),
    numberInput("mean_stress_mpa", "0"),
    document.createTextNode("MPa")
  );
  meanRow.dataset.calcShow = "professional";
  inputsCard.append(meanRow);

  const methodRow = fieldRow(
    document.createTextNode(t("mean_method")),
    selectInput(
      "mean_stress_method",
      [
        ["goodman", t("method_goodman")],
        ["soderberg", t("method_soderberg")],
      ],
      "goodman"
    ),
    document.createTextNode("")
  );
  methodRow.dataset.calcShow = "professional";
  inputsCard.append(methodRow);

  const surfaceRow = fieldRow(
    document.createTextNode(t("surface_factor")),
    numberInput("surface_factor", "0.9"),
    document.createTextNode("-")
  );
  surfaceRow.dataset.calcShow = "professional";
  inputsCard.append(surfaceRow);

  const sizeRow = fieldRow(
    document.createTextNode(t("size_factor")),
    numberInput("size_factor", "0.85"),
    document.createTextNode("-")
  );
  sizeRow.dataset.calcShow = "professional";
  inputsCard.append(sizeRow);

  const spectrum = document.createElement("textarea");
  spectrum.className = "mechbox__inputs mechbox-fatigue__textarea";
  spectrum.name = "loads_json";
  spectrum.rows = 5;
  spectrum.placeholder = t("spectrum_placeholder");
  spectrum.value = "300,10000\n250,50000\n200,100000";
  const spectrumRow = fieldRow(
    document.createTextNode(t("load_spectrum")),
    spectrum,
    document.createTextNode("")
  );
  spectrumRow.dataset.calcShow = "full professional";
  spectrumRow.classList.add("mechbox-fatigue__field--spectrum");
  inputsCard.append(spectrumRow);

  const spectrumHint = document.createElement("p");
  spectrumHint.className = "mechbox-fatigue__hint";
  spectrumHint.dataset.calcShow = "full professional";
  spectrumHint.textContent = t("spectrum_hint");
  inputsCard.append(spectrumHint);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-fatigue__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateFatigue(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-fatigue__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-fatigue__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-fatigue__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
