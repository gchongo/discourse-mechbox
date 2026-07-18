import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  fillFormulaBar,
  mixedLabel,
  typesetRoot,
} from "./mechbox-tex";

function t(key, options) {
  return i18n(`mechbox.gear_ratio.${key}`, options);
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function fieldRow(labelText, control, unitText) {
  const row = document.createElement("div");
  row.className = "mechbox-gear-ratio__field";

  const label = document.createElement("label");
  label.className = "mechbox-gear-ratio__label";
  label.append(document.createTextNode(labelText));

  const controlWrap = document.createElement("div");
  controlWrap.className = "mechbox-gear-ratio__control";
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = "mechbox-gear-ratio__unit";
  unit.textContent = unitText || "";

  row.append(label, controlWrap, unit);
  return row;
}

function numberInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "mechbox__inputs mechbox-gear-ratio__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.type = "number";
  return input;
}

function resultRow(labelParts, valueParts) {
  const row = document.createElement("div");
  row.className = "mechbox-gear-ratio__result-row";
  const dt = document.createElement("dt");
  dt.append(mixedLabel(labelParts));
  const dd = document.createElement("dd");
  dd.append(mixedLabel(valueParts));
  row.append(dt, dd);
  return row;
}

function collectInputs(root) {
  return {
    driver_teeth: Number(root.querySelector('input[name="driver_teeth"]')?.value),
    driven_teeth: Number(root.querySelector('input[name="driven_teeth"]')?.value),
    input_speed_rpm: Number(root.querySelector('input[name="input_speed_rpm"]')?.value),
  };
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-gear-ratio__error");
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

async function renderResults(panel, payload) {
  const box = panel.querySelector(".mechbox-gear-ratio__results-body");
  if (!box) {
    return;
  }

  const outputs = payload?.outputs || {};
  box.replaceChildren();
  box.classList.add("is-visible");

  const list = document.createElement("dl");
  list.className = "mechbox-gear-ratio__result-list";
  list.append(
    resultRow(
      [{ text: `${t("result_ratio")} ` }, { tex: "i" }],
      [{ text: formatNumber(outputs.ratio, 6) }]
    ),
    resultRow(
      [{ text: `${t("result_output_speed")} ` }, { tex: "n_2" }],
      [{ text: `${formatNumber(outputs.output_speed_rpm, 3)} rpm` }]
    )
  );
  box.append(list);
  await typesetRoot(box);
}

async function calculateGearRatio(panel, button) {
  const root = panel.querySelector(".mechbox-gear-ratio");
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
        tool_id: "gear_ratio",
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

export async function mountGearRatioWorkbench(panel) {
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
    "mechbox__workbench-panel--gear-ratio"
  );
  panel.classList.add("mechbox__workbench-panel--gear-ratio");

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
  root.className = "mechbox-gear-ratio";

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-gear-ratio__formula-bar";
  fillFormulaBar(formulaBar, {
    title: t("formula_title"),
    hint: t("formula_hint"),
    formulas: ["i=z_2/z_1", "n_2=n_1/i"],
  });

  const grid = document.createElement("div");
  grid.className = "mechbox-gear-ratio__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-gear-ratio__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = t("input_title");
  inputsCard.append(inputsTitle);

  inputsCard.append(
    fieldRow(t("driver_teeth"), numberInput("driver_teeth", "20"), t("unit_teeth")),
    fieldRow(t("driven_teeth"), numberInput("driven_teeth", "40"), t("unit_teeth")),
    fieldRow(t("input_speed"), numberInput("input_speed_rpm", "1500"), "rpm")
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-gear-ratio__calculate-btn";
  calcBtn.textContent = t("calculate");
  calcBtn.addEventListener("click", () => calculateGearRatio(panel, calcBtn));
  inputsCard.append(calcBtn);

  const error = document.createElement("div");
  error.className = "mechbox-gear-ratio__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-gear-ratio__card";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = t("results_title");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-gear-ratio__results-body";
  resultsBody.textContent = t("results_empty");
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(formulaBar, grid);
  mount.append(root);

  await typesetRoot(formulaBar);
}
