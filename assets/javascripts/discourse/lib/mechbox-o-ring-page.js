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
const AS568 = [1.78, 2.62, 3.53, 5.33, 6.99];
const MATERIALS = ["nbr", "fkm", "epdm"];

function t(key, options) {
  return i18n(`mechbox.o_ring.${key}`, options);
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
  row.className = "mechbox-o-ring__field";
  const label = document.createElement("label");
  label.className = "mechbox-o-ring__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-o-ring__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-o-ring__unit";
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
  input.className = "mechbox__inputs mechbox-o-ring__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-o-ring__select";
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
  const bar = root.querySelector(".mechbox-o-ring__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "h=d_{\\mathrm{cs}}(1-\\varepsilon)",
        "\\eta=(\\pi d_{\\mathrm{cs}}^{2}/4)/(w h)",
      ],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["g_{\\max}=\\max(0.05,\\,0.25-0.008p)"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["p_{\\max}=35\\,(0.25/\\max(g,0.05))", "v\\le 0.5\\,\\mathrm{m/s}"],
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

function recommendGroove(root) {
  const bore = Number(root.querySelector('input[name="bore_recommend_mm"]')?.value);
  const cs = Number(root.querySelector('input[name="cross_section_mm"]')?.value);
  if (!(bore > 0) || !(cs > 0)) {
    return;
  }
  // MechBox recommendGroove: D_g = D - 2*cs*0.75, w = 1.4*cs, ε = 20%
  root.querySelector('input[name="groove_diameter_mm"]').value = (
    bore -
    2 * cs * 0.75
  ).toFixed(2);
  root.querySelector('input[name="groove_width_mm"]').value = (cs * 1.4).toFixed(2);
  root.querySelector('input[name="compression_percent"]').value = "20";
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const inputs = {
    calc_mode: calcMode,
    cross_section_mm: Number(root.querySelector('input[name="cross_section_mm"]')?.value),
    groove_diameter_mm: Number(root.querySelector('input[name="groove_diameter_mm"]')?.value),
    groove_width_mm: Number(root.querySelector('input[name="groove_width_mm"]')?.value),
    compression_percent: Number(
      root.querySelector('input[name="compression_percent"]')?.value
    ),
    stretch_percent: Number(root.querySelector('input[name="stretch_percent"]')?.value),
    pressure_mpa: Number(root.querySelector('input[name="pressure_mpa"]')?.value || 0),
  };

  if (calcMode !== "simple") {
    inputs.extrusion_gap_mm = Number(
      root.querySelector('input[name="extrusion_gap_mm"]')?.value || 0.15
    );
    inputs.material = root.querySelector('select[name="material"]')?.value || "nbr";
    inputs.operating_temp_c = Number(
      root.querySelector('input[name="operating_temp_c"]')?.value || 25
    );
  }

  if (calcMode === "professional") {
    inputs.stroke_speed_m_s = Number(
      root.querySelector('input[name="stroke_speed_m_s"]')?.value || 0
    );
    const thermal = root.querySelector('input[name="thermal_expansion"]')?.value;
    if (thermal !== "" && thermal != null) {
      inputs.thermal_expansion = Number(thermal);
    }
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-o-ring__result-row";
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

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-o-ring__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-o-ring__status ${outputs.pass ? "is-pass" : "is-attention"}`;
  status.textContent = `${t("overall")}: ${outputs.pass ? t("status_pass") : t("status_attention")}`;
  box.append(status);

  const list = document.createElement("dl");
  list.className = "mechbox-o-ring__result-list";

  list.append(
    resultRow(
      [{ text: t("result_compression") }],
      [
        {
          text: `${formatNumber(outputs.compression_mm, 3)} mm (${formatNumber(
            outputs.compression_percent,
            1
          )}%)`,
        },
      ],
      { danger: outputs.compression_ok === false }
    ),
    resultRow(
      [{ text: t("result_groove_depth") }],
      [{ tex: `${formatNumber(outputs.groove_depth_mm, 3)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: t("result_fill") }],
      [{ text: `${formatNumber(outputs.fill_percent, 1)}% (65–85%)` }],
      { danger: outputs.fill_ok === false }
    ),
    resultRow(
      [{ text: t("result_rec_width") }],
      [{ tex: `${formatNumber(outputs.recommended_width_mm, 2)}\\,\\mathrm{mm}` }]
    ),
    resultRow(
      [{ text: t("result_width") }],
      [{ text: outputs.width_ok ? t("width_ok") : t("width_bad") }],
      { danger: outputs.width_ok === false }
    ),
    resultRow(
      [{ text: t("result_ids") }],
      [
        {
          text: `${formatNumber(outputs.free_id_mm, 2)} / ${formatNumber(
            outputs.installed_id_mm,
            2
          )} mm`,
        },
      ]
    )
  );

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: t("result_extrusion") }],
        [
          {
            text: `${formatNumber(outputs.extrusion_gap_mm, 2)} / ${formatNumber(
              outputs.max_extrusion_gap_mm,
              2
            )} mm`,
          },
        ],
        { danger: outputs.extrusion_pass === false }
      ),
      resultRow(
        [{ text: t("result_material") }],
        [{ text: `${outputs.material_name || outputs.material} @ ${formatNumber(outputs.operating_temp_c, 0)} °C` }],
        { danger: outputs.temp_pass === false }
      )
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_max_pressure") }],
        [{ text: `${formatNumber(outputs.max_allow_pressure_mpa, 1)} MPa` }],
        { danger: outputs.pressure_pass === false }
      ),
      resultRow(
        [{ text: t("result_speed") }],
        [{ text: `${formatNumber(outputs.stroke_speed_m_s, 2)} m/s` }],
        { danger: outputs.speed_pass === false }
      )
    );
    if (outputs.thermal_compression_change_mm != null) {
      list.append(
        resultRow(
          [{ text: t("result_thermal") }],
          [{ text: `${formatNumber(outputs.thermal_compression_change_mm, 3)} mm` }],
          { danger: outputs.thermal_pass === false }
        )
      );
    }
  }

  const note = document.createElement("p");
  note.className = "mechbox-o-ring__hint";
  note.textContent = t(outputs.notes_key === "dynamic" ? "notes_dynamic" : "notes_static");
  box.append(list, note);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-o-ring__error");
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

async function calculateORing(panel, button) {
  const root = panel.querySelector(".mechbox-o-ring");
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
        tool_id: "o_ring",
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

export async function mountORingWorkbench(panel) {
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
    "mechbox__workbench-panel--fatigue",
    "mechbox__workbench-panel--beam",
    "mechbox__workbench-panel--sheet-metal",
    "mechbox__workbench-panel--cylinder",
    "mechbox__workbench-panel--o-ring",
    "mechbox__workbench-panel--structural"
  );
  panel.classList.add("mechbox__workbench-panel--o-ring");

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
  root.className = "mechbox-o-ring";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-o-ring__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-o-ring__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-o-ring__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-o-ring__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-o-ring__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const csInput = numberInput("cross_section_mm", "3.53");
  inputsCard.append(
    fieldRow(document.createTextNode(t("cross_section")), csInput, document.createTextNode("mm"))
  );

  const presets = document.createElement("div");
  presets.className = "mechbox-o-ring__presets";
  const presetLabel = document.createElement("span");
  presetLabel.textContent = t("as568");
  presets.append(presetLabel);
  AS568.forEach((cs) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-default btn-small";
    btn.textContent = String(cs);
    btn.addEventListener("click", () => {
      csInput.value = String(cs);
    });
    presets.append(btn);
  });
  inputsCard.append(presets);

  inputsCard.append(
    fieldRow(
      document.createTextNode(t("groove_diameter")),
      numberInput("groove_diameter_mm", "18.5"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("groove_width")),
      numberInput("groove_width_mm", "4.8"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("compression")),
      numberInput("compression_percent", "20"),
      document.createTextNode("%")
    ),
    fieldRow(
      document.createTextNode(t("stretch")),
      numberInput("stretch_percent", "2"),
      document.createTextNode("%")
    ),
    fieldRow(
      document.createTextNode(t("pressure")),
      numberInput("pressure_mpa", "0"),
      document.createTextNode("MPa")
    )
  );

  const gapRow = fieldRow(
    document.createTextNode(t("extrusion_gap")),
    numberInput("extrusion_gap_mm", "0.15"),
    document.createTextNode("mm")
  );
  gapRow.dataset.calcShow = "full professional";
  inputsCard.append(gapRow);

  const matRow = fieldRow(
    document.createTextNode(t("material")),
    selectInput(
      "material",
      MATERIALS.map((id) => [id, t(`material_${id}`)]),
      "nbr"
    ),
    document.createTextNode("")
  );
  matRow.dataset.calcShow = "full professional";
  inputsCard.append(matRow);

  const tempRow = fieldRow(
    document.createTextNode(t("operating_temp")),
    numberInput("operating_temp_c", "25"),
    document.createTextNode("°C")
  );
  tempRow.dataset.calcShow = "full professional";
  inputsCard.append(tempRow);

  const speedRow = fieldRow(
    document.createTextNode(t("stroke_speed")),
    numberInput("stroke_speed_m_s", "0"),
    document.createTextNode("m/s")
  );
  speedRow.dataset.calcShow = "professional";
  inputsCard.append(speedRow);

  const thermalRow = fieldRow(
    document.createTextNode(t("thermal_expansion")),
    numberInput("thermal_expansion", ""),
    document.createTextNode("-")
  );
  thermalRow.dataset.calcShow = "professional";
  inputsCard.append(thermalRow);

  const boreRow = fieldRow(
    document.createTextNode(t("bore_recommend")),
    numberInput("bore_recommend_mm", "25"),
    document.createTextNode("mm")
  );
  inputsCard.append(boreRow);

  const recBtn = document.createElement("button");
  recBtn.type = "button";
  recBtn.className = "btn btn-default mechbox-o-ring__recommend";
  recBtn.textContent = t("apply_recommend");
  recBtn.addEventListener("click", () => recommendGroove(root));
  inputsCard.append(recBtn);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-o-ring__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateORing(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-o-ring__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-o-ring__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-o-ring__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
