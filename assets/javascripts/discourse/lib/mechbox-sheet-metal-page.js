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
const METHODS = ["k_factor", "bend_deduction"];
const K_PRESETS = [
  ["air_bend", 0.33],
  ["tight", 0.38],
  ["coining", 0.42],
  ["aluminum", 0.35],
];

const DEFAULT_SEGMENTS = [
  { type: "straight", length: 50 },
  { type: "bend", angle: 90 },
  { type: "straight", length: 80 },
  { type: "bend", angle: 90 },
  { type: "straight", length: 50 },
];

function t(key, options) {
  return i18n(`mechbox.sheet_metal.${key}`, options);
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
  row.className = "mechbox-sheet-metal__field";
  const label = document.createElement("label");
  label.className = "mechbox-sheet-metal__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-sheet-metal__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-sheet-metal__unit";
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
  input.className = "mechbox__inputs mechbox-sheet-metal__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-sheet-metal__select";
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
  const method = root.querySelector('select[name="method"]')?.value || "k_factor";

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-method-show]").forEach((el) => {
    const methods = (el.dataset.methodShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-method-hidden", !methods.includes(method));
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
  const bar = root.querySelector(".mechbox-sheet-metal__formula-bar");
  if (!bar) {
    return;
  }

  const calcMode = getCalcMode(root);
  const method = root.querySelector('select[name="method"]')?.value || "k_factor";

  if (calcMode === "simple") {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t(method === "bend_deduction" ? "estimate_warning_bd" : "estimate_warning"),
      formulas:
        method === "bend_deduction"
          ? ["L=\\sum L_{\\mathrm{outer}}-\\sum BD", "BD=2(R+T)\\tan(\\theta/2)-BA"]
          : ["BA=\\theta_{\\mathrm{rad}}(R+K T)", "L=\\sum L_{\\mathrm{flat}}+\\sum BA"],
    });
  } else if (calcMode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: ["L_{\\mathrm{flange,min}}=4T"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["L'=L(1+\\alpha/(90 n))", "R\\ge T"],
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

function segmentState(root) {
  if (!root._segments) {
    root._segments = DEFAULT_SEGMENTS.map((s) => ({ ...s }));
  }
  return root._segments;
}

function renderSegments(root) {
  const list = root.querySelector(".mechbox-sheet-metal__segments");
  if (!list) {
    return;
  }
  list.replaceChildren();
  const segments = segmentState(root);

  segments.forEach((seg, index) => {
    const row = document.createElement("div");
    row.className = "mechbox-sheet-metal__segment-row";

    const typeSelect = selectInput(
      `seg_type_${index}`,
      [
        ["straight", t("seg_straight")],
        ["bend", t("seg_bend")],
      ],
      seg.type
    );
    typeSelect.addEventListener("change", () => {
      seg.type = typeSelect.value;
      if (seg.type === "straight") {
        seg.length = seg.length ?? 30;
        delete seg.angle;
      } else {
        seg.angle = seg.angle ?? 90;
        delete seg.length;
      }
      renderSegments(root);
    });

    row.append(typeSelect);

    if (seg.type === "straight") {
      const lengthInput = numberInput(`seg_length_${index}`, String(seg.length ?? 30));
      lengthInput.addEventListener("change", () => {
        seg.length = Number(lengthInput.value);
      });
      lengthInput.addEventListener("input", () => {
        seg.length = Number(lengthInput.value);
      });
      const wrap = document.createElement("div");
      wrap.className = "mechbox-sheet-metal__segment-field";
      const lbl = document.createElement("span");
      lbl.textContent = t("seg_length");
      wrap.append(lbl, lengthInput, document.createTextNode(" mm"));
      row.append(wrap);
    } else {
      const angleInput = numberInput(`seg_angle_${index}`, String(seg.angle ?? 90));
      angleInput.addEventListener("change", () => {
        seg.angle = Number(angleInput.value);
      });
      angleInput.addEventListener("input", () => {
        seg.angle = Number(angleInput.value);
      });
      const wrap = document.createElement("div");
      wrap.className = "mechbox-sheet-metal__segment-field";
      const lbl = document.createElement("span");
      lbl.textContent = t("seg_angle");
      wrap.append(lbl, angleInput, document.createTextNode(" °"));
      row.append(wrap);
    }

    if (segments.length > 1) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-default btn-small mechbox-sheet-metal__seg-remove";
      removeBtn.textContent = t("seg_remove");
      removeBtn.addEventListener("click", () => {
        segments.splice(index, 1);
        renderSegments(root);
      });
      row.append(removeBtn);
    }

    list.append(row);
  });
}

function collectInputs(root) {
  const calcMode = getCalcMode(root);
  const method = root.querySelector('select[name="method"]')?.value || "k_factor";
  const segments = segmentState(root).map((seg) => {
    if (seg.type === "bend") {
      return { type: "bend", angle: Number(seg.angle) || 90 };
    }
    return { type: "straight", length: Number(seg.length) || 0 };
  });

  const inputs = {
    calc_mode: calcMode,
    method,
    thickness_mm: Number(root.querySelector('input[name="thickness_mm"]')?.value),
    bend_radius_mm: Number(root.querySelector('input[name="bend_radius_mm"]')?.value),
    k_factor: Number(root.querySelector('input[name="k_factor"]')?.value),
    segments_json: JSON.stringify(segments),
  };

  if (method === "bend_deduction") {
    inputs.outer_sum_mm = Number(root.querySelector('input[name="outer_sum_mm"]')?.value);
  }

  if (calcMode === "professional") {
    inputs.springback_deg = Number(
      root.querySelector('input[name="springback_deg"]')?.value || 0.5
    );
  }

  return inputs;
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-sheet-metal__result-row";
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

function renderDetailsTable(details) {
  const wrap = document.createElement("div");
  wrap.className = "mechbox-sheet-metal__miner";
  const title = document.createElement("h4");
  title.textContent = t("details_title");
  wrap.append(title);

  const table = document.createElement("table");
  table.className = "mechbox-sheet-metal__curve-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>#</th><th>${t("details_type")}</th><th>${t("details_contribution")}</th></tr>`;
  table.append(thead);
  const tbody = document.createElement("tbody");
  (details || []).forEach((row) => {
    const tr = document.createElement("tr");
    const typeLabel = row.type === "bend" ? t("seg_bend") : t("seg_straight");
    tr.innerHTML = `<td>${Number(row.index) + 1}</td><td>${typeLabel}</td><td>${formatNumber(
      row.contribution_mm,
      3
    )}</td>`;
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-sheet-metal__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-sheet-metal__status ${
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
  list.className = "mechbox-sheet-metal__result-list";

  const flat =
    calcMode === "professional" && outputs.compensated_flat_length_mm != null
      ? outputs.compensated_flat_length_mm
      : outputs.flat_length_mm;

  list.append(
    resultRow(
      [{ text: t("result_flat") }],
      [{ tex: `${formatNumber(flat, 2)}\\,\\mathrm{mm}` }]
    ),
    resultRow([{ text: t("result_bends") }], [{ text: String(outputs.bend_count ?? "—") }]),
    resultRow(
      [{ text: t("result_method") }],
      [
        {
          text:
            outputs.method === "bend_deduction"
              ? t("method_bend_deduction")
              : t("method_k_factor"),
        },
      ]
    )
  );

  if (calcMode !== "simple") {
    list.append(
      resultRow(
        [{ text: t("result_min_flange") }],
        [{ text: `${formatNumber(outputs.min_flange_rule_mm, 1)} mm` }]
      ),
      resultRow(
        [{ text: t("result_min_straight") }],
        [{ text: `${formatNumber(outputs.min_straight_length_mm, 1)} mm` }],
        { danger: outputs.flange_pass === false }
      )
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_springback") }],
        [{ text: `${formatNumber(outputs.springback_deg, 1)} °` }]
      ),
      resultRow(
        [{ text: t("result_radius") }],
        [
          {
            text: outputs.radius_pass ? t("radius_ok") : t("radius_adjust"),
          },
        ],
        { danger: outputs.radius_pass === false }
      )
    );
  }

  box.append(list);
  if (outputs.details?.length) {
    box.append(renderDetailsTable(outputs.details));
  }
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-sheet-metal__error");
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

async function calculateSheetMetal(panel, button) {
  const root = panel.querySelector(".mechbox-sheet-metal");
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
        tool_id: "sheet_metal",
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

export async function mountSheetMetalWorkbench(panel) {
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
    "mechbox__workbench-panel--cylinder"
  );
  panel.classList.add("mechbox__workbench-panel--sheet-metal");

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
  root.className = "mechbox-sheet-metal";
  setCalcMode(root, "simple");
  root._segments = DEFAULT_SEGMENTS.map((s) => ({ ...s }));

  const modes = document.createElement("div");
  modes.className = "mechbox-sheet-metal__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-sheet-metal__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", () => applyCalcMode(root, mode));
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-sheet-metal__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-sheet-metal__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-sheet-metal__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const methodSelect = selectInput(
    "method",
    METHODS.map((id) => [id, t(`method_${id}`)]),
    "k_factor"
  );
  methodSelect.addEventListener("change", () => {
    syncVisibility(root);
    updateFormulaBar(root);
  });

  inputsCard.append(
    fieldRow(document.createTextNode(t("method")), methodSelect, document.createTextNode("")),
    fieldRow(
      document.createTextNode(t("thickness")),
      numberInput("thickness_mm", "1.5"),
      document.createTextNode("mm")
    ),
    fieldRow(
      document.createTextNode(t("bend_radius")),
      numberInput("bend_radius_mm", "1.5"),
      document.createTextNode("mm")
    )
  );

  const kInput = numberInput("k_factor", "0.33");
  const kPreset = selectInput(
    "k_preset",
    [["", t("k_preset_custom")], ...K_PRESETS.map(([id]) => [id, t(`k_preset_${id}`)])],
    ""
  );
  kPreset.addEventListener("change", () => {
    const found = K_PRESETS.find(([id]) => id === kPreset.value);
    if (found) {
      kInput.value = String(found[1]);
    }
  });
  const kControl = document.createElement("div");
  kControl.className = "mechbox-sheet-metal__k-wrap";
  kControl.append(kInput, kPreset);
  inputsCard.append(
    fieldRow(document.createTextNode(t("k_factor")), kControl, document.createTextNode(""))
  );

  const outerRow = fieldRow(
    document.createTextNode(t("outer_sum")),
    numberInput("outer_sum_mm", "200"),
    document.createTextNode("mm")
  );
  outerRow.dataset.methodShow = "bend_deduction";
  inputsCard.append(outerRow);

  const springRow = fieldRow(
    document.createTextNode(t("springback")),
    numberInput("springback_deg", "0.5"),
    document.createTextNode("°")
  );
  springRow.dataset.calcShow = "professional";
  inputsCard.append(springRow);

  const segTitle = document.createElement("h4");
  segTitle.className = "mechbox-sheet-metal__section-title";
  segTitle.textContent = t("segments_title");
  inputsCard.append(segTitle);

  const segList = document.createElement("div");
  segList.className = "mechbox-sheet-metal__segments";
  inputsCard.append(segList);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-default mechbox-sheet-metal__seg-add";
  addBtn.textContent = t("seg_add");
  addBtn.addEventListener("click", () => {
    segmentState(root).push({ type: "straight", length: 30 });
    renderSegments(root);
  });
  inputsCard.append(addBtn);

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-sheet-metal__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateSheetMetal(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-sheet-metal__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-sheet-metal__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-sheet-metal__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);

  renderSegments(root);
  syncVisibility(root);
  syncModeTabs(root);
  updateFormulaBar(root);
}
