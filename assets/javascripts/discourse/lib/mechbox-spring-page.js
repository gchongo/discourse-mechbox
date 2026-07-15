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
const MATERIALS = [
  "50CrVA",
  "60Si2CrA",
  "65Mn",
  "music_wire",
  "oil_tempered",
  "stainless",
  "custom",
];

function t(key, options) {
  return i18n(`mechbox.spring.${key}`, options);
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
  row.className = "mechbox-spring__field";
  const label = document.createElement("label");
  label.className = "mechbox-spring__label";
  label.append(labelEl);
  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-spring__control";
  controlWrap.append(control);
  const unit = document.createElement("span");
  unit.className = "mechbox-spring__unit";
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
  input.className = "mechbox__inputs mechbox-spring__input";
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
  const bar = root.querySelector(".mechbox-spring__formula-bar");
  if (!bar) {
    return;
  }
  const mode = getCalcMode(root);
  if (mode === "full") {
    fillFormulaBar(bar, {
      title: t("formula_title_full"),
      hint: t("estimate_warning_full"),
      formulas: [
        "k = \\dfrac{G d^{4}}{8 D^{3} n}",
        "b = H_{0}/D\\;\\text{(buckling)}",
      ],
    });
  } else if (mode === "professional") {
    fillFormulaBar(bar, {
      title: t("formula_title_pro"),
      hint: t("estimate_warning_pro"),
      formulas: ["S = (\\tau_{u0} + 0.75\\tau_{\\min}) / \\tau_{\\max}"],
    });
  } else {
    fillFormulaBar(bar, {
      title: t("formula_title"),
      hint: t("estimate_warning"),
      formulas: [
        "k = \\dfrac{G d^{4}}{8 D^{3} n}",
        "\\tau = \\dfrac{8 F D}{\\pi d^{3}} K",
      ],
    });
  }
  typesetRoot(bar);
}

function applyCalcMode(root, mode) {
  setCalcMode(root, mode);
  root.querySelectorAll(".mechbox-spring__mode-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.calcMode === mode);
  });
  syncVisibility(root);
  syncFormulaBar(root);
}

function resultRow(labelParts, valueParts, options = {}) {
  const row = document.createElement("div");
  row.className = "mechbox-spring__result-row";
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
    material: root.querySelector('select[name="material"]')?.value || "50CrVA",
    wire_diameter_mm: num("wire_diameter_mm"),
    mean_diameter_mm: num("mean_diameter_mm"),
    active_coils: num("active_coils"),
    allowable_shear_mpa: num("allowable_shear_mpa"),
  };

  if (mode === "simple") {
    inputs.load_n = num("load_n");
  } else {
    inputs.outer_diameter_mm = num("outer_diameter_mm");
    inputs.mean_diameter_mm = Math.max(
      0,
      inputs.outer_diameter_mm - inputs.wire_diameter_mm
    );
    inputs.total_coils = num("total_coils");
    inputs.free_length_mm = num("free_length_mm");
    inputs.install_height_mm = num("install_height_mm");
    inputs.working_height_mm = num("working_height_mm");
    inputs.end_type =
      root.querySelector('select[name="end_type"]')?.value || "fixed";
  }

  if (mode === "professional") {
    inputs.load_min_n = num("load_min_n");
    inputs.load_max_n = num("load_max_n");
    inputs.target_cycles = num("target_cycles");
    inputs.tensile_strength_mpa = num("tensile_strength_mpa");
    inputs.excitation_frequency_hz = num("excitation_frequency_hz");
  }

  return inputs;
}

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-spring__results-body");
  if (!box) {
    return;
  }
  const outputs = payload?.outputs || {};
  const calcMode = outputs.calc_mode || "simple";
  box.replaceChildren();
  box.classList.add("is-visible");

  const status = document.createElement("div");
  status.className = `mechbox-spring__status ${
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
  list.className = "mechbox-spring__result-list";
  list.append(
    resultRow(
      [{ text: `${t("result_rate")} ` }, { tex: "k" }],
      [
        {
          tex: `${formatNumber(outputs.spring_rate_n_per_mm, 3)}\\,\\mathrm{N/mm}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("result_deflection")} ` }, { tex: "f" }],
      [{ tex: `${formatNumber(outputs.deflection_mm, 2)}\\,\\mathrm{mm}` }]
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
      [{ text: t("result_allow") }],
      [
        {
          tex: `${formatNumber(outputs.allowable_shear_mpa, 0)}\\,\\mathrm{MPa}`,
        },
      ]
    ),
    resultRow(
      [{ text: `${t("result_index")} ` }, { tex: "C" }],
      [{ text: formatNumber(outputs.spring_index, 2) }],
      { danger: outputs.index_pass === false }
    ),
    resultRow(
      [{ text: `${t("result_wahl")} ` }, { tex: "K" }],
      [{ text: formatNumber(outputs.wahl_factor, 3) }]
    )
  );

  if (calcMode === "full" || calcMode === "professional") {
    if (outputs.working_load_n != null) {
      list.append(
        resultRow(
          [{ text: t("result_working_load") }],
          [{ tex: `${formatNumber(outputs.working_load_n, 1)}\\,\\mathrm{N}` }]
        )
      );
    }
    list.append(
      resultRow(
        [{ text: t("result_solid") }],
        [
          {
            tex: `${formatNumber(outputs.solid_height_mm, 1)}\\,\\mathrm{mm}`,
          },
        ]
      ),
      resultRow(
        [{ text: t("result_buckling") }],
        [
          {
            text: `${formatNumber(outputs.buckling?.slenderness, 2)} ≤ ${formatNumber(outputs.buckling?.critical_slenderness, 1)}`,
          },
        ],
        { danger: outputs.buckling?.pass === false }
      ),
      resultRow(
        [{ text: t("result_test_load") }],
        [
          {
            text: `${formatNumber(outputs.test_load_n, 1)} N · fs=${formatNumber(outputs.test_deflection_mm, 2)} mm`,
          },
        ]
      ),
      resultRow(
        [{ text: t("result_characteristic") }],
        [
          {
            text: outputs.characteristic_ratio == null
              ? "—"
              : `f/fs=${formatNumber(outputs.characteristic_ratio, 2)}`,
          },
        ],
        { danger: outputs.characteristic_pass === false }
      ),
      resultRow(
        [{ text: t("result_natural_freq") }],
        [
          {
            tex: `${formatNumber(outputs.natural_frequency_hz, 1)}\\,\\mathrm{Hz}`,
          },
        ]
      )
    );
  }

  if (calcMode === "professional") {
    list.append(
      resultRow(
        [{ text: t("result_shear_amp") }],
        [
          {
            tex: `${formatNumber(outputs.shear_amplitude_mpa, 1)}\\,\\mathrm{MPa}`,
          },
        ]
      ),
      resultRow(
        [{ text: t("result_fatigue_s") }],
        [
          {
            text: `${formatNumber(outputs.fatigue_safety_factor, 2)} (≥ ${formatNumber(outputs.fatigue_min_safety, 1)})`,
          },
        ],
        { danger: outputs.fatigue_pass === false }
      )
    );
  }

  box.append(list);
  await typesetRoot(box);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-spring__error");
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

async function calculateSpring(panel, button) {
  const root = panel.querySelector(".mechbox-spring");
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
        tool_id: "spring",
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

export async function mountSpringWorkbench(panel) {
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
    "mechbox__workbench-panel--spring"
  );
  panel.classList.add("mechbox__workbench-panel--spring");

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
  root.className = "mechbox-spring";
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-spring__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-spring__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeTabLabel(mode);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyCalcMode(root, mode);
    });
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-spring__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-spring__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-spring__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  const materialSelect = document.createElement("select");
  materialSelect.name = "material";
  materialSelect.className = "mechbox__inputs mechbox-spring__input";
  MATERIALS.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = t(`material_${m}`);
    materialSelect.append(opt);
  });
  const materialRow = fieldRow(
    document.createTextNode(t("material")),
    materialSelect,
    document.createTextNode("—")
  );
  materialRow.dataset.calcShow = "full professional";

  const endSelect = document.createElement("select");
  endSelect.name = "end_type";
  endSelect.className = "mechbox__inputs mechbox-spring__input";
  [
    ["fixed", "end_fixed"],
    ["guided", "end_guided"],
    ["rotating", "end_rotating"],
  ].forEach(([value, key]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = t(key);
    endSelect.append(opt);
  });

  const meanRow = fieldRow(
    mixedLabel([{ text: t("mean_diameter") }, { text: " " }, { tex: "D" }]),
    numberInput("mean_diameter_mm", "5.4"),
    document.createTextNode("mm")
  );
  meanRow.dataset.calcShow = "simple";

  const outerRow = fieldRow(
    mixedLabel([{ text: t("outer_diameter") }, { text: " " }, { tex: "D_{o}" }]),
    numberInput("outer_diameter_mm", "6.5"),
    document.createTextNode("mm")
  );
  outerRow.dataset.calcShow = "full professional";

  const loadRow = fieldRow(
    mixedLabel([{ text: t("load") }, { text: " " }, { tex: "F" }]),
    numberInput("load_n", "150"),
    document.createTextNode("N")
  );
  loadRow.dataset.calcShow = "simple";

  const freeRow = fieldRow(
    mixedLabel([{ text: t("free_length") }, { text: " " }, { tex: "H_{0}" }]),
    numberInput("free_length_mm", "15"),
    document.createTextNode("mm")
  );
  freeRow.dataset.calcShow = "full professional";

  const installRow = fieldRow(
    mixedLabel([{ text: t("install_height") }, { text: " " }, { tex: "H_{1}" }]),
    numberInput("install_height_mm", "13"),
    document.createTextNode("mm")
  );
  installRow.dataset.calcShow = "full professional";

  const workingRow = fieldRow(
    mixedLabel([{ text: t("working_height") }, { text: " " }, { tex: "H_{2}" }]),
    numberInput("working_height_mm", "12"),
    document.createTextNode("mm")
  );
  workingRow.dataset.calcShow = "full professional";

  const totalRow = fieldRow(
    document.createTextNode(t("total_coils")),
    numberInput("total_coils", "7"),
    document.createTextNode("—")
  );
  totalRow.dataset.calcShow = "full professional";

  const endRow = fieldRow(
    document.createTextNode(t("end_type")),
    endSelect,
    document.createTextNode("—")
  );
  endRow.dataset.calcShow = "full professional";

  const loadMinRow = fieldRow(
    document.createTextNode(t("load_min")),
    numberInput("load_min_n", "50"),
    document.createTextNode("N")
  );
  loadMinRow.dataset.calcShow = "professional";

  const loadMaxRow = fieldRow(
    document.createTextNode(t("load_max")),
    numberInput("load_max_n", "200"),
    document.createTextNode("N")
  );
  loadMaxRow.dataset.calcShow = "professional";

  const cyclesRow = fieldRow(
    document.createTextNode(t("target_cycles")),
    numberInput("target_cycles", "1000000"),
    document.createTextNode("—")
  );
  cyclesRow.dataset.calcShow = "professional";

  const rmRow = fieldRow(
    mixedLabel([{ text: t("tensile_strength") }, { text: " " }, { tex: "R_{m}" }]),
    numberInput("tensile_strength_mpa", "1810"),
    document.createTextNode("MPa")
  );
  rmRow.dataset.calcShow = "professional";

  const excRow = fieldRow(
    document.createTextNode(t("excitation")),
    numberInput("excitation_frequency_hz", "0"),
    document.createTextNode("Hz")
  );
  excRow.dataset.calcShow = "professional";

  inputsCard.append(
    materialRow,
    fieldRow(
      mixedLabel([{ text: t("wire_diameter") }, { text: " " }, { tex: "d" }]),
      numberInput("wire_diameter_mm", "1.1"),
      document.createTextNode("mm")
    ),
    meanRow,
    outerRow,
    fieldRow(
      mixedLabel([{ text: t("active_coils") }, { text: " " }, { tex: "n" }]),
      numberInput("active_coils", "5"),
      document.createTextNode("—")
    ),
    totalRow,
    loadRow,
    fieldRow(
      mixedLabel([
        { text: t("allowable_shear") },
        { text: " " },
        { tex: "[\\tau]" },
      ]),
      numberInput("allowable_shear_mpa", "529"),
      document.createTextNode("MPa")
    ),
    freeRow,
    installRow,
    workingRow,
    endRow,
    loadMinRow,
    loadMaxRow,
    cyclesRow,
    rmRow,
    excRow
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-spring__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculateSpring(panel, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-spring__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-spring__card mechbox-spring__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-spring__results-body";
  resultsBody.innerHTML = `<p class="mechbox-spring__results-empty">${t(
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
