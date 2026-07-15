import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

const UNIT_GROUPS = [
  {
    id: "length",
    units: ["mm", "cm", "m", "in", "ft"],
  },
  {
    id: "pressure",
    units: ["mpa", "psi"],
  },
  {
    id: "force",
    units: ["n", "lbf"],
  },
  {
    id: "speed",
    units: ["rpm"],
  },
];

function t(key, options) {
  return i18n(`mechbox.units.${key}`, options);
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) < 0.001)) {
    return num.toExponential(6).replace(/\.?0+e/, "e");
  }
  return Number(num.toPrecision(8)).toString();
}

function fieldRow(labelText, control) {
  const row = document.createElement("div");
  row.className = "mechbox-units__field";

  const label = document.createElement("label");
  label.className = "mechbox-units__label";
  label.textContent = labelText;

  row.append(label, control);
  return row;
}

function fillUnitSelect(select, units, selected) {
  select.replaceChildren();
  for (const unit of units) {
    const option = document.createElement("option");
    option.value = unit;
    option.textContent = unit;
    if (unit === selected) {
      option.selected = true;
    }
    select.append(option);
  }
}

function groupById(id) {
  return UNIT_GROUPS.find((group) => group.id === id) || UNIT_GROUPS[0];
}

export function mountUnitsWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove("mechbox__workbench-panel--bolt");
  panel.classList.add("mechbox__workbench-panel--units");
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-units";

  const grid = document.createElement("div");
  grid.className = "mechbox-units__grid";

  const formCard = document.createElement("section");
  formCard.className = "mechbox-units__card";

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-units__card mechbox-units__results";

  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-units__results-body";
  resultsBody.innerHTML = `<p class="mechbox-units__empty">${t("results_empty")}</p>`;

  const categorySelect = document.createElement("select");
  categorySelect.className = "mechbox-units__control";
  categorySelect.name = "dimension";
  for (const group of UNIT_GROUPS) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = t(`dimension.${group.id}`);
    categorySelect.append(option);
  }

  const valueInput = document.createElement("input");
  valueInput.className = "mechbox-units__control mechbox__inputs";
  valueInput.type = "number";
  valueInput.name = "value";
  valueInput.dataset.type = "number";
  valueInput.step = "any";
  valueInput.value = "25.4";
  valueInput.autocomplete = "off";

  const fromSelect = document.createElement("select");
  fromSelect.className = "mechbox-units__control mechbox__inputs";
  fromSelect.name = "from_unit";
  fromSelect.dataset.type = "string";

  const toSelect = document.createElement("select");
  toSelect.className = "mechbox-units__control mechbox__inputs";
  toSelect.name = "to_unit";
  toSelect.dataset.type = "string";

  function syncUnits() {
    const group = groupById(categorySelect.value);
    const preferredFrom = group.units.includes(fromSelect.value)
      ? fromSelect.value
      : group.units[0];
    const preferredTo =
      group.units.find((unit) => unit !== preferredFrom) || group.units[0];
    fillUnitSelect(fromSelect, group.units, preferredFrom);
    fillUnitSelect(toSelect, group.units, preferredTo);
  }

  categorySelect.addEventListener("change", syncUnits);
  syncUnits();

  const swapBtn = document.createElement("button");
  swapBtn.type = "button";
  swapBtn.className = "btn btn-default mechbox-units__swap";
  swapBtn.textContent = t("swap");
  swapBtn.addEventListener("click", () => {
    const from = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = from;
  });

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-units__calculate-btn";
  calcBtn.textContent = t("calculate");

  const actions = document.createElement("div");
  actions.className = "mechbox-units__actions";
  actions.append(calcBtn);

  formCard.append(
    fieldRow(t("dimension_label"), categorySelect),
    fieldRow(t("value"), valueInput),
    fieldRow(t("from_unit"), fromSelect),
    fieldRow(t("to_unit"), toSelect),
    swapBtn,
    actions
  );

  resultsCard.append(
    Object.assign(document.createElement("h3"), {
      className: "mechbox-units__results-title",
      textContent: t("results_title"),
    }),
    resultsBody
  );

  grid.append(formCard, resultsCard);
  root.append(grid);
  mount.append(root);

  calcBtn.addEventListener("click", async () => {
    const original = calcBtn.textContent;
    calcBtn.disabled = true;
    calcBtn.textContent = i18n("mechbox.calculating");

    try {
      const result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: "unit_converter",
          save_record: false,
          inputs: {
            value: Number(valueInput.value),
            from_unit: fromSelect.value,
            to_unit: toSelect.value,
          },
        },
      });

      const outputs = result?.outputs || {};
      const converted = formatNumber(outputs.converted_value);
      const fromUnit = outputs.from_unit || fromSelect.value;
      const toUnit = outputs.to_unit || toSelect.value;
      const inputVal = formatNumber(valueInput.value);

      resultsBody.replaceChildren();

      const hero = document.createElement("div");
      hero.className = "mechbox-units__hero";
      hero.innerHTML = `
        <span class="mechbox-units__hero-from">${inputVal} ${fromUnit}</span>
        <span class="mechbox-units__hero-eq">=</span>
        <span class="mechbox-units__hero-to">${converted} ${toUnit}</span>
      `;

      const note = document.createElement("p");
      note.className = "mechbox-units__note";
      note.textContent = t("result_note");

      resultsBody.append(hero, note);
    } catch (error) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        resultsBody.replaceChildren();
        const err = document.createElement("p");
        err.className = "mechbox-units__error";
        err.textContent = error.jqXHR.responseJSON.errors.join(" ");
        resultsBody.append(err);
      } else {
        popupAjaxError(error);
      }
    } finally {
      calcBtn.disabled = false;
      calcBtn.textContent = original;
    }
  });

  panel.dataset.mounted = "true";
}
