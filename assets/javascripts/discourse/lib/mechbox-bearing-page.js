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
const SERIES_IDS = [
  "deep-groove-light",
  "deep-groove-medium",
  "deep-groove-heavy",
  "angular-25",
  "angular-40",
  "self-aligning",
  "cylindrical-roller",
  "spherical-roller",
  "taper-roller",
  "thrust-ball",
];
const MODEL_PRESETS = {
  "6205": { c: "14000", c0: "7800", series: "deep-groove-medium", type: "ball" },
  "6206": { c: "19500", c0: "11300", series: "deep-groove-medium", type: "ball" },
  "6208": { c: "32500", c0: "19000", series: "deep-groove-medium", type: "ball" },
  "6305": { c: "22500", c0: "11400", series: "deep-groove-heavy", type: "ball" },
  "6308": { c: "42300", c0: "24000", series: "deep-groove-heavy", type: "ball" },
  "NU206": { c: "44000", c0: "36500", series: "cylindrical-roller", type: "roller" },
  "30206": { c: "43600", c0: "50000", series: "taper-roller", type: "roller" },
};

function t(key, options) {
  return i18n(`mechbox.bearing.${key}`, options);
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "∞";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelEl, control, unitEl) {
  const row = document.createElement("div");
  row.className = "mechbox-bearing__field";
  const label = document.createElement("label");
  label.className = "mechbox-bearing__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-bearing__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-bearing__unit";
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
  input.className = "mechbox__inputs mechbox-bearing__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-bearing__select";
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
  syncLookupVisibility(root);
}

function syncLookupVisibility(root) {
  const calcMode = getCalcMode(root);
  const auto = root.querySelector('select[name="auto_lookup"]')?.value !== "false";
  root.querySelectorAll("[data-lookup-show]").forEach((el) => {
    const want = el.dataset.lookupShow;
    let show = false;
    if (want === "auto") {
      show = calcMode !== "simple" && auto;
    } else if (want === "manual") {
      show = calcMode === "simple" || !auto;
    }
    el.classList.toggle("is-mode-hidden", !show);
  });
}

function syncModeTabs(root) {
  const calcMode = getCalcMode(root);
  root.querySelectorAll("[data-calc-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.calcMode === calcMode);
  });
}

function updateFormulaBar(root) {
  const bar = root.querySelector(".mechbox-bearing__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "P=X F_r+Y F_a",
        "L_{10}=(C/P)^{\\varepsilon}",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "L_{nm}=a_1 a_{ISO} L_{10}",
        "L_h=L_{nm}\\times10^6/(60 n)",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "L_{nm}=a_1 a_{ISO} a_2 L_{10}",
        "S_0=C_0/P",
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
  row.className = "mechbox-bearing__result-row";
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
    dynamic_load_n: Number(root.querySelector('input[name="dynamic_load_n"]')?.value),
    radial_load_n: Number(root.querySelector('input[name="radial_load_n"]')?.value),
    axial_load_n: Number(root.querySelector('input[name="axial_load_n"]')?.value || 0),
    rpm: Number(root.querySelector('input[name="rpm"]')?.value),
    target_hours: Number(root.querySelector('input[name="target_hours"]')?.value),
  };

  const model = root.querySelector('select[name="bearing_model"]')?.value;
  if (model) {
    inputs.bearing_model = model;
  }

  if (calcMode === "simple") {
    inputs.bearing_type =
      root.querySelector('select[name="bearing_type"]')?.value || "ball";
    inputs.x = Number(root.querySelector('input[name="x"]')?.value);
    inputs.y = Number(root.querySelector('input[name="y"]')?.value);
    inputs.auto_lookup = false;
  } else {
    const auto =
      root.querySelector('select[name="auto_lookup"]')?.value !== "false";
    inputs.auto_lookup = auto;
    if (auto) {
      inputs.series_id =
        root.querySelector('select[name="series_id"]')?.value ||
        "deep-groove-medium";
    } else {
      inputs.bearing_type =
        root.querySelector('select[name="bearing_type"]')?.value || "ball";
      inputs.x = Number(root.querySelector('input[name="x"]')?.value);
      inputs.y = Number(root.querySelector('input[name="y"]')?.value);
    }
    inputs.static_load_n = Number(
      root.querySelector('input[name="static_load_n"]')?.value
    );
    inputs.life_condition =
      root.querySelector('select[name="life_condition"]')?.value || "standard";
    inputs.reliability = Number(
      root.querySelector('select[name="reliability"]')?.value || 90
    );
    inputs.mounting_arrangement =
      root.querySelector('select[name="mounting_arrangement"]')?.value ||
      "single";
    inputs.axial_preload_n = Number(
      root.querySelector('input[name="axial_preload_n"]')?.value || 0
    );
  }

  if (calcMode === "professional") {
    inputs.operating_temp_c = Number(
      root.querySelector('input[name="operating_temp_c"]')?.value || 120
    );
    const limit = root.querySelector('input[name="limiting_speed_rpm"]')?.value;
    if (limit) {
      inputs.limiting_speed_rpm = Number(limit);
    }
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-bearing__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-bearing__status ${
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
  list.className = "mechbox-bearing__result-list";

  list.append(
    resultRow(
      [{ text: `${t("result_equivalent")} ` }, { tex: "P" }],
      [{ tex: `${formatNumber(outputs.equivalent_load, 1)}\\,\\mathrm{N}` }]
    ),
    resultRow(
      [{ text: `${t("result_xy")} ` }, { tex: "X,Y" }],
      [{ text: `${formatNumber(outputs.x, 2)} / ${formatNumber(outputs.y, 2)}` }]
    ),
    resultRow(
      [{ text: `${t("result_l10")} ` }, { tex: "L_{10}" }],
      [{ text: formatNumber(outputs.l10_million_rev, 3) }]
    ),
    resultRow(
      [{ text: `${t("result_life_hours")} ` }, { tex: "L_h" }],
      [{ text: `${formatNumber(outputs.life_hours, 0)} h` }],
      { danger: outputs.life_pass === false }
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: `${t("result_lnm")} ` }, { tex: "L_{nm}" }],
        [{ text: formatNumber(outputs.modified_life_million_rev, 3) }]
      ),
      resultRow(
        [{ text: t("result_modifiers") }],
        [
          {
            text: `a₁=${formatNumber(outputs.reliability_factor, 2)} · aISO=${formatNumber(
              outputs.life_condition_factor,
              2
            )}${
              calcMode === "professional"
                ? ` · a₂=${formatNumber(outputs.temperature_factor, 2)}`
                : ""
            }`,
          },
        ]
      )
    );
    if (outputs.static_safety_factor != null) {
      list.append(
        resultRow(
          [{ text: `${t("result_static_safety")} ` }, { tex: "S_0" }],
          [{ text: formatNumber(outputs.static_safety_factor, 2) }],
          { danger: outputs.static_pass === false }
        )
      );
    }
  }

  if (calcMode === "professional") {
    if (outputs.radial_stiffness != null) {
      list.append(
        resultRow(
          [{ text: t("result_stiffness") }],
          [{ tex: `${formatNumber(outputs.radial_stiffness, 2)}\\,\\mathrm{N/\\mu m}` }]
        )
      );
    }
    if (outputs.speed_pass === false) {
      list.append(
        resultRow(
          [{ text: t("result_speed") }],
          [{ text: t("speed_exceeded") }],
          { danger: true }
        )
      );
    }
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-bearing__error");
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

async function calculateBearing(panel, button) {
  const root = panel.querySelector(".mechbox-bearing");
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
        tool_id: "bearing",
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

function applyModelPreset(root) {
  const model = root.querySelector('select[name="bearing_model"]')?.value;
  const preset = MODEL_PRESETS[model];
  if (!preset) {
    return;
  }
  const c = root.querySelector('input[name="dynamic_load_n"]');
  const c0 = root.querySelector('input[name="static_load_n"]');
  const series = root.querySelector('select[name="series_id"]');
  const type = root.querySelector('select[name="bearing_type"]');
  if (c) {
    c.value = preset.c;
  }
  if (c0) {
    c0.value = preset.c0;
  }
  if (series) {
    series.value = preset.series;
  }
  if (type) {
    type.value = preset.type;
  }
}

export async function mountBearingWorkbench(panel) {
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
    "mechbox__workbench-panel--bearing"
  );
  panel.classList.add("mechbox__workbench-panel--bearing");

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
  root.className = "mechbox-bearing";

  const modes = document.createElement("div");
  modes.className = "mechbox-bearing__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-bearing__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-bearing__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-bearing__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-bearing__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const modelSelect = selectInput(
    "bearing_model",
    [
      ["", t("model_custom")],
      ...Object.keys(MODEL_PRESETS).map((m) => [m, m]),
    ],
    "6205"
  );
  modelSelect.addEventListener("change", () => applyModelPreset(root));

  const autoLookup = selectInput(
    "auto_lookup",
    [
      ["true", t("lookup_auto")],
      ["false", t("lookup_manual")],
    ],
    "true"
  );
  autoLookup.addEventListener("change", () => syncLookupVisibility(root));
  const autoRow = fieldRow(
    document.createTextNode(t("xy_lookup")),
    autoLookup,
    document.createTextNode("")
  );
  autoRow.dataset.calcShow = "full professional";

  const seriesSelect = selectInput(
    "series_id",
    SERIES_IDS.map((id) => [id, t(`series_${id.replace(/-/g, "_")}`)]),
    "deep-groove-medium"
  );
  const seriesRow = fieldRow(
    document.createTextNode(t("series")),
    seriesSelect,
    document.createTextNode("")
  );
  seriesRow.dataset.lookupShow = "auto";

  const typeSelect = selectInput(
    "bearing_type",
    [
      ["ball", t("type_ball")],
      ["roller", t("type_roller")],
    ],
    "ball"
  );
  const typeRow = fieldRow(
    document.createTextNode(t("bearing_type")),
    typeSelect,
    document.createTextNode("")
  );
  typeRow.dataset.lookupShow = "manual";

  const xRow = fieldRow(
    mixedLabel([{ text: "X" }]),
    numberInput("x", "1"),
    document.createTextNode("—")
  );
  xRow.dataset.lookupShow = "manual";
  const yRow = fieldRow(
    mixedLabel([{ text: "Y" }]),
    numberInput("y", "0"),
    document.createTextNode("—")
  );
  yRow.dataset.lookupShow = "manual";

  const staticRow = fieldRow(
    mixedLabel([{ text: t("static_load") }, { text: " " }, { tex: "C_0" }]),
    numberInput("static_load_n", "7800"),
    document.createTextNode("N")
  );
  staticRow.dataset.calcShow = "full professional";

  const conditionRow = fieldRow(
    document.createTextNode(t("life_condition")),
    selectInput(
      "life_condition",
      [
        ["clean", t("condition_clean")],
        ["standard", t("condition_standard")],
        ["contaminated", t("condition_contaminated")],
        ["heavy", t("condition_heavy")],
      ],
      "standard"
    ),
    document.createTextNode("")
  );
  conditionRow.dataset.calcShow = "full professional";

  const reliabilityRow = fieldRow(
    document.createTextNode(t("reliability")),
    selectInput(
      "reliability",
      [
        ["90", "90% (a₁=1.0)"],
        ["95", "95% (a₁=0.64)"],
        ["96", "96% (a₁=0.55)"],
        ["97", "97% (a₁=0.47)"],
        ["98", "98% (a₁=0.37)"],
        ["99", "99% (a₁=0.25)"],
      ],
      "90"
    ),
    document.createTextNode("")
  );
  reliabilityRow.dataset.calcShow = "full professional";

  const mountingRow = fieldRow(
    document.createTextNode(t("mounting")),
    selectInput(
      "mounting_arrangement",
      [
        ["single", t("mount_single")],
        ["duplex-db", t("mount_db")],
        ["duplex-df", t("mount_df")],
        ["duplex-dt", t("mount_dt")],
      ],
      "single"
    ),
    document.createTextNode("")
  );
  mountingRow.dataset.calcShow = "full professional";

  const preloadRow = fieldRow(
    mixedLabel([{ text: t("axial_preload") }, { text: " " }, { tex: "F_0" }]),
    numberInput("axial_preload_n", "0"),
    document.createTextNode("N")
  );
  preloadRow.dataset.calcShow = "full professional";

  const tempRow = fieldRow(
    mixedLabel([{ text: t("operating_temp") }, { text: " " }, { tex: "T" }]),
    numberInput("operating_temp_c", "120"),
    document.createTextNode("°C")
  );
  tempRow.dataset.calcShow = "professional";

  const limitRow = fieldRow(
    document.createTextNode(t("limiting_speed")),
    numberInput("limiting_speed_rpm", "8000"),
    document.createTextNode("rpm")
  );
  limitRow.dataset.calcShow = "professional";

  inputsCard.append(
    fieldRow(document.createTextNode(t("model")), modelSelect, document.createTextNode("")),
    autoRow,
    seriesRow,
    typeRow,
    fieldRow(
      mixedLabel([{ text: t("dynamic_load") }, { text: " " }, { tex: "C" }]),
      numberInput("dynamic_load_n", "14000"),
      document.createTextNode("N")
    ),
    staticRow,
    fieldRow(
      mixedLabel([{ text: t("radial_load") }, { text: " " }, { tex: "F_r" }]),
      numberInput("radial_load_n", "5000"),
      document.createTextNode("N")
    ),
    fieldRow(
      mixedLabel([{ text: t("axial_load") }, { text: " " }, { tex: "F_a" }]),
      numberInput("axial_load_n", "1000"),
      document.createTextNode("N")
    ),
    mountingRow,
    preloadRow,
    xRow,
    yRow,
    fieldRow(
      mixedLabel([{ text: t("rpm") }, { text: " " }, { tex: "n" }]),
      numberInput("rpm", "1500"),
      document.createTextNode("rpm")
    ),
    reliabilityRow,
    conditionRow,
    fieldRow(
      document.createTextNode(t("target_hours")),
      numberInput("target_hours", "10000"),
      document.createTextNode("h")
    ),
    tempRow,
    limitRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-bearing__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateBearing(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-bearing__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-bearing__card mechbox-bearing__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-bearing__results-body";
  resultsBody.innerHTML = `<p class="mechbox-bearing__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  applyCalcMode(root, "simple");
}
