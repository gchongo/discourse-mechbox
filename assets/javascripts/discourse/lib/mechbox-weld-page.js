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
const WELD_TYPES = ["fillet", "butt"];
const STEEL_GRADES = ["Q235", "Q345", "S235", "S355", "A36"];

function t(key, options) {
  return i18n(`mechbox.weld.${key}`, options);
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
  row.className = "mechbox-weld__field";

  const label = document.createElement("label");
  label.className = "mechbox-weld__label";
  label.append(labelEl);

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-weld__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-weld__unit";
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
  input.className = "mechbox__inputs mechbox-weld__input";
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

function getWeldType(root) {
  return root.dataset.weldType || "fillet";
}

function setWeldType(root, type) {
  root.dataset.weldType = type;
}

function syncVisibility(root) {
  const calcMode = getCalcMode(root);
  const weldType = getWeldType(root);

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(calcMode));
  });

  root.querySelectorAll("[data-weld-show]").forEach((el) => {
    const types = (el.dataset.weldShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !types.includes(weldType));
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
  const bar = root.querySelector(".mechbox-weld__formula-bar");
  if (!bar) {
    return;
  }

  const mode = getCalcMode(root);
  const weldType = getWeldType(root);

  if (weldType === "butt") {
    if (mode === "professional") {
      fillFormulaBar(bar, {
        title: t("formula_title_butt_pro"),
        hint: t("estimate_warning_pro"),
        formulas: ["\\sigma_{\\mathrm{eff}} = K_f\\,\\sigma / \\eta"],
      });
    } else if (mode === "full") {
      fillFormulaBar(bar, {
        title: t("formula_title_butt_full"),
        hint: t("estimate_warning_full"),
        formulas: ["\\sigma = F/(t L)"],
      });
    } else {
      fillFormulaBar(bar, {
        title: t("formula_title_butt"),
        hint: t("estimate_warning"),
        formulas: ["\\sigma = F/(t L)"],
      });
    }
  } else if (mode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "a = 0.7 s",
        "\\tau = F/(a L)\\;\\text{(GB / EC / AWS)}",
      ],
    });
  } else if (mode === "professional") {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: [
        "\\sigma_{\\mathrm{eq}} = \\sqrt{\\sigma_b^2 + 3\\tau^2}",
        "\\text{HAZ / fatigue gate}",
      ],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: ["a = 0.7 s,\\quad \\tau = F/(a L)"],
    });
  }

  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  root.querySelectorAll(".mechbox-weld__mode-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.calcMode === mode);
  });
  syncVisibility(root);
  syncFormulaBar(root);
}

function applyWeldType(root, type) {
  setWeldType(root, type);
  root.querySelectorAll(".mechbox-weld__type-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.weldType === type);
  });
  syncVisibility(root);
  syncFormulaBar(root);
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-weld__result-row";
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
  const weldType = getWeldType(root);
  const num = (name) =>
    Number(root.querySelector(`input[name="${name}"]`)?.value);
  const grade =
    root.querySelector('select[name="steel_grade"]')?.value || "Q235";

  const inputs = {
    calc_mode: mode,
    weld_type: weldType,
    steel_grade: grade,
    weld_length_mm: num("weld_length_mm"),
    force_n: num("force_n"),
  };

  if (weldType === "fillet") {
    inputs.leg_size_mm = num("leg_size_mm");
    if (mode === "professional") {
      inputs.eccentricity_mm = num("eccentricity_mm");
      inputs.heat_input = num("heat_input");
      inputs.plate_thickness_mm = num("plate_thickness_mm");
      inputs.stress_range_mpa = num("stress_range_mpa");
    }
  } else {
    inputs.thickness_mm = num("thickness_mm");
    if (mode === "professional") {
      inputs.penetration_efficiency = num("penetration_efficiency");
      inputs.stress_concentration = num("stress_concentration");
    }
  }

  return inputs;
}

function renderStandardsTable(box, standards, allowKey = "allowable_shear_mpa") {
  if (!standards?.length) {
    return;
  }

  const heading = document.createElement("h4");
  heading.className = "mechbox-weld__section-title";
  heading.textContent = t("result_standards");
  box.append(heading);

  const table = document.createElement("table");
  table.className = "mechbox-weld__bolt-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [t("col_standard"), t("col_allowable"), t("col_check")].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  standards.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.pass === false) {
      tr.classList.add("is-danger");
    }
    const allow = row[allowKey] ?? row.allow_mpa;
    [
      row.standard || row.id,
      formatNumber(allow, 1),
      row.pass ? t("status_pass") : t("status_attention"),
    ].forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = String(cell);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  box.append(table);
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-weld__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  const weldType = outputs.weld_type || "fillet";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-weld__status ${
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
  list.className = "mechbox-weld__result-list";

  if (weldType === "fillet") {
    list.append(
      resultRow(
        [{ text: `${t("result_throat")} ` }, { tex: "a" }],
        [{ tex: `${formatNumber(outputs.throat_mm, 2)}\\,\\mathrm{mm}` }]
      ),
      resultRow(
        [{ text: `${t("result_shear")} ` }, { tex: "\\tau" }],
        [
          {
            tex: `${formatNumber(outputs.shear_stress_mpa, 1)}\\,\\mathrm{MPa}`,
          },
        ],
        { danger: outputs.shear_pass === false }
      )
    );

    if (outputs.strictest_standard) {
      list.append(
        resultRow(
          [{ text: t("result_strictest") }],
          [
            {
              text: `${outputs.strictest_standard} (${formatNumber(outputs.strictest_allowable_mpa, 1)} MPa)`,
            },
          ]
        )
      );
    }

    if (outputs.combined) {
      list.append(
        resultRow(
          [{ text: `${t("result_combined")} ` }, { tex: "\\sigma_{\\mathrm{eq}}" }],
          [
            {
              tex: `${formatNumber(outputs.combined.equivalent_stress_mpa, 1)}\\,\\mathrm{MPa}`,
            },
          ],
          { danger: outputs.combined_pass === false }
        )
      );
    }

    if (outputs.haz) {
      list.append(
        resultRow(
          [{ text: t("result_haz") }],
          [
            {
              text: `${formatNumber(outputs.haz.haz_allow_shear_mpa, 1)} / ${formatNumber(outputs.haz.weld_stress_mpa, 1)} MPa`,
            },
          ],
          { danger: outputs.haz.pass === false }
        )
      );
    }

    if (outputs.fatigue) {
      list.append(
        resultRow(
          [{ text: t("result_fatigue") }],
          [
            {
              text: `${formatNumber(outputs.fatigue.stress_range_mpa, 1)} ≤ ${formatNumber(outputs.fatigue.allowable_at_cycles_mpa, 1)} MPa`,
            },
          ],
          { danger: outputs.fatigue.pass === false }
        )
      );
    }
  } else {
    list.append(
      resultRow(
        [{ text: `${t("result_normal")} ` }, { tex: "\\sigma" }],
        [
          {
            tex: `${formatNumber(outputs.normal_stress_mpa, 1)}\\,\\mathrm{MPa}`,
          },
        ]
      )
    );
    if (outputs.effective_stress_mpa != null) {
      list.append(
        resultRow(
          [
            { text: `${t("result_effective")} ` },
            { tex: "\\sigma_{\\mathrm{eff}}" },
          ],
          [
            {
              tex: `${formatNumber(outputs.effective_stress_mpa, 1)}\\,\\mathrm{MPa}`,
            },
          ]
        )
      );
    }
  }

  box.append(list);
  renderStandardsTable(
    box,
    outputs.standards,
    weldType === "butt" ? "allow_mpa" : "allowable_shear_mpa"
  );
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-weld__error");
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

async function calculateWeld(panel, button) {
  const root = panel.querySelector(".mechbox-weld");
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
        tool_id: "weld",
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

export async function mountWeldWorkbench(panel) {
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
    "mechbox__workbench-panel--weld"
  );
  panel.classList.add("mechbox__workbench-panel--weld");

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
  root.className = "mechbox-weld";
  setCalcMode(root, "simple");
  setWeldType(root, "fillet");

  const typeTabs = document.createElement("div");
  typeTabs.className = "mechbox-weld__modes";
  WELD_TYPES.forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-weld__type-tab mechbox-weld__mode-tab";
    btn.dataset.weldType = type;
    btn.textContent = type === "butt" ? t("type_butt") : t("type_fillet");
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyWeldType(root, type);
    });
    typeTabs.append(btn);
  });

  const modes = document.createElement("div");
  modes.className = "mechbox-weld__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-weld__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyCalcMode(root, mode);
    });
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-weld__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-weld__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-weld__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const gradeSelect = document.createElement("select");
  gradeSelect.name = "steel_grade";
  gradeSelect.className = "mechbox__inputs mechbox-weld__input";
  STEEL_GRADES.forEach((grade) => {
    const opt = document.createElement("option");
    opt.value = grade;
    opt.textContent = grade;
    gradeSelect.append(opt);
  });

  const legRow = fieldRow(
    mixedLabel([{ text: t("leg_size") }, { text: " " }, { tex: "s" }]),
    numberInput("leg_size_mm", "6"),
    document.createTextNode("mm")
  );
  legRow.dataset.weldShow = "fillet";

  const thicknessRow = fieldRow(
    mixedLabel([{ text: t("thickness") }, { text: " " }, { tex: "t" }]),
    numberInput("thickness_mm", "8"),
    document.createTextNode("mm")
  );
  thicknessRow.dataset.weldShow = "butt";

  const eccRow = fieldRow(
    mixedLabel([{ text: t("eccentricity") }, { text: " " }, { tex: "e" }]),
    numberInput("eccentricity_mm", "0"),
    document.createTextNode("mm")
  );
  eccRow.dataset.calcShow = "professional";
  eccRow.dataset.weldShow = "fillet";

  const heatRow = fieldRow(
    document.createTextNode(t("heat_input")),
    numberInput("heat_input", "1.5"),
    document.createTextNode("kJ/mm")
  );
  heatRow.dataset.calcShow = "professional";
  heatRow.dataset.weldShow = "fillet";

  const plateRow = fieldRow(
    document.createTextNode(t("plate_thickness")),
    numberInput("plate_thickness_mm", "8"),
    document.createTextNode("mm")
  );
  plateRow.dataset.calcShow = "professional";
  plateRow.dataset.weldShow = "fillet";

  const rangeRow = fieldRow(
    document.createTextNode(t("stress_range")),
    numberInput("stress_range_mpa", "0"),
    document.createTextNode("MPa")
  );
  rangeRow.dataset.calcShow = "professional";
  rangeRow.dataset.weldShow = "fillet";

  const effRow = fieldRow(
    mixedLabel([{ text: t("penetration") }, { text: " " }, { tex: "\\eta" }]),
    numberInput("penetration_efficiency", "1"),
    document.createTextNode("—")
  );
  effRow.dataset.calcShow = "professional";
  effRow.dataset.weldShow = "butt";

  const kfRow = fieldRow(
    mixedLabel([{ text: t("concentration") }, { text: " " }, { tex: "K_f" }]),
    numberInput("stress_concentration", "1.2"),
    document.createTextNode("—")
  );
  kfRow.dataset.calcShow = "professional";
  kfRow.dataset.weldShow = "butt";

  inputsCard.append(
    fieldRow(document.createTextNode(t("steel_grade")), gradeSelect, document.createTextNode("—")),
    legRow,
    thicknessRow,
    fieldRow(
      mixedLabel([{ text: t("weld_length") }, { text: " " }, { tex: "L" }]),
      numberInput("weld_length_mm", "80"),
      document.createTextNode("mm")
    ),
    fieldRow(
      mixedLabel([{ text: t("force") }, { text: " " }, { tex: "F" }]),
      numberInput("force_n", "20000"),
      document.createTextNode("N")
    ),
    eccRow,
    heatRow,
    plateRow,
    rangeRow,
    effRow,
    kfRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-weld__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateWeld(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-weld__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-weld__card mechbox-weld__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-weld__results-body";
  resultsBody.innerHTML = `<p class="mechbox-weld__results-empty">${t(
    "results_empty"
  )}</p>`;
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(typeTabs, modes, formulaBar, grid);
  mount.append(root);

  applyWeldType(root, "fillet");
  applyCalcMode(root, "simple");
  await typesetRoot(root);
  panel.dataset.mounted = "true";
}
