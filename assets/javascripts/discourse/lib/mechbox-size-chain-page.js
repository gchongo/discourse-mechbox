import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

const WORKBENCH_PANEL_CLASSES = [
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
  "mechbox__workbench-panel--structural",
  "mechbox__workbench-panel--manufacturing",
  "mechbox__workbench-panel--heat-treatment",
  "mechbox__workbench-panel--materials",
  "mechbox__workbench-panel--material-selection",
  "mechbox__workbench-panel--thread-table",
  "mechbox__workbench-panel--size-chain",
  "mechbox__workbench-panel--gdt-stack",
  "mechbox__workbench-panel--monte-carlo",
];

function t(key, options) {
  return i18n(`mechbox.size_chain.${key}`, options);
}

function translated(key, fallback, options) {
  const value = t(key, options);
  return value.startsWith("mechbox.size_chain.") ? fallback : value;
}

function formatNumber(value, digits = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return Number(number.toFixed(digits)).toString();
}

function numberInput(name, value, className) {
  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.step = "any";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.className = `mechbox__inputs ${className}`;
  return input;
}

function textInput(name, value, className) {
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  input.className = `mechbox__inputs ${className}`;
  return input;
}

function appendResultRow(list, labelText, valueText, danger = false) {
  const row = document.createElement("div");
  row.className = "mechbox-size-chain__result-row";
  row.classList.toggle("is-danger", danger);
  const label = document.createElement("dt");
  label.textContent = labelText;
  const value = document.createElement("dd");
  value.textContent = valueText;
  row.append(label, value);
  list.append(row);
}

function normalizedResult(result) {
  const value = result || {};
  return {
    nominal: value.nominal ?? value.nominal_value,
    lower: value.lower ?? value.lower_limit ?? value.min,
    upper: value.upper ?? value.upper_limit ?? value.max,
    tolerance: value.tolerance ?? value.total_tolerance,
    pass: value.pass ?? value.is_pass,
  };
}

function renderMethodCard(method, label, unit) {
  const card = document.createElement("section");
  card.className = "mechbox-size-chain__method-card";
  const title = document.createElement("h4");
  title.textContent = label;
  const result = normalizedResult(method);
  const values = document.createElement("dl");
  values.className = "mechbox-size-chain__result-list";
  appendResultRow(
    values,
    translated("nominal", "Nominal"),
    `${formatNumber(result.nominal)} ${unit}`
  );
  appendResultRow(
    values,
    translated("lower_limit", "Lower limit"),
    `${formatNumber(result.lower)} ${unit}`,
    result.pass === false
  );
  appendResultRow(
    values,
    translated("upper_limit", "Upper limit"),
    `${formatNumber(result.upper)} ${unit}`,
    result.pass === false
  );
  appendResultRow(
    values,
    translated("tolerance", "Tolerance"),
    `${formatNumber(result.tolerance)} ${unit}`
  );
  appendResultRow(
    values,
    translated("pass", "Status"),
    result.pass === true
      ? translated("pass_value", "Pass")
      : result.pass === false
        ? translated("fail_value", "Fail")
        : "—",
    result.pass === false
  );
  card.append(title, values);
  return card;
}

function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-size-chain");
  const body = panel.querySelector(".mechbox-size-chain__results-body");
  if (!root || !body) {
    return;
  }

  const outputs = payload?.outputs || {};
  const worst = normalizedResult(outputs.worst_case ?? outputs.worst ?? outputs.extreme);
  const rss = normalizedResult(outputs.rss ?? outputs.rss_result);
  const unit = outputs.unit || root.dataset.unit || "mm";
  const closed = collectInputs(root).closed_ring;
  body.replaceChildren();

  const spec = document.createElement("p");
  spec.className = "mechbox-size-chain__spec-band";
  spec.textContent = `${translated("spec_band", "Specification band")}: ${formatNumber(
    closed.min
  )}–${formatNumber(closed.max)} ${unit}`;

  const methods = document.createElement("div");
  methods.className = "mechbox-size-chain__method-grid";
  methods.append(
    renderMethodCard(worst, translated("worst_case", "Worst case"), unit),
    renderMethodCard(rss, translated("rss", "RSS"), unit)
  );
  body.append(spec);

  if (rss.pass === true && worst.pass === false) {
    const warning = document.createElement("p");
    warning.className = "mechbox-size-chain__warning";
    warning.textContent = translated(
      "rss_warning",
      "RSS passes, but the worst-case result does not meet the specification."
    );
    body.append(warning);
  }

  body.append(methods);

  const contributions =
    outputs.ring_contributions ?? outputs.contributions ?? outputs.contribution_percentages;
  if (Array.isArray(contributions) && contributions.length) {
    const contributionSection = document.createElement("section");
    contributionSection.className = "mechbox-size-chain__contributions";
    const title = document.createElement("h4");
    title.textContent = translated("contributions", "Tolerance contributions");
    const list = document.createElement("ul");
    list.className = "mechbox-size-chain__contribution-list";
    contributions.forEach((contribution, index) => {
      const item = document.createElement("li");
      const name = contribution.name ?? root.querySelectorAll("[data-ring-row]")[index]?.querySelector('[name="name"]')?.value ?? "—";
      const percentage =
        contribution.percentage ??
        contribution.percent ??
        contribution.contribution_percentage ??
        contribution.value;
      item.textContent = `${name}: ${formatNumber(percentage, 2)}%`;
      list.append(item);
    });
    contributionSection.append(title, list);
    body.append(contributionSection);
  }
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-size-chain__error");
  if (!error) {
    return;
  }
  error.hidden = !message;
  error.textContent = message || "";
}

function collectInputs(root) {
  const closedRing = {
    name: root.querySelector('[name="closed-name"]')?.value || "",
    min: Number(root.querySelector('[name="closed-min"]')?.value),
    max: Number(root.querySelector('[name="closed-max"]')?.value),
    unit: root.dataset.unit || "mm",
  };
  const componentRings = [...root.querySelectorAll("[data-ring-row]")].map((row) => ({
    name: row.querySelector('[name="name"]')?.value || "",
    nominal_size: Number(row.querySelector('[name="nominal_size"]')?.value),
    total_tolerance: Number(row.querySelector('[name="total_tolerance"]')?.value),
    type: row.querySelector('[name="type"]')?.value || "increasing",
    factor: Number(row.querySelector('[name="factor"]')?.value),
  }));
  return { closed_ring: closedRing, component_rings: componentRings };
}

function addRingRow(tbody, ring = {}) {
  const row = document.createElement("tr");
  row.dataset.ringRow = "true";

  const fields = [
    textInput("name", ring.name || "", "mechbox-size-chain__input"),
    numberInput("nominal_size", ring.nominal_size ?? "", "mechbox-size-chain__input"),
    numberInput("total_tolerance", ring.total_tolerance ?? "", "mechbox-size-chain__input"),
  ];
  fields.forEach((field) => {
    const cell = document.createElement("td");
    cell.append(field);
    row.append(cell);
  });

  const typeCell = document.createElement("td");
  const type = document.createElement("select");
  type.name = "type";
  type.className = "mechbox__inputs mechbox-size-chain__select";
  [
    ["increasing", translated("increasing", "Increasing")],
    ["decreasing", translated("decreasing", "Decreasing")],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = (ring.type || "increasing") === value;
    type.append(option);
  });
  typeCell.append(type);
  row.append(typeCell);

  const factorCell = document.createElement("td");
  factorCell.append(numberInput("factor", ring.factor ?? 1, "mechbox-size-chain__input"));
  row.append(factorCell);

  const removeCell = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-default mechbox-size-chain__remove-ring";
  remove.textContent = translated("remove_ring", "Remove");
  remove.addEventListener("click", () => row.remove());
  removeCell.append(remove);
  row.append(removeCell);
  tbody.append(row);
}

async function calculate(panel, button) {
  const root = panel.querySelector(".mechbox-size-chain");
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
        tool_id: "size_chain",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    renderResults(panel, result);
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

export async function mountSizeChainWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--size-chain");
  ["mechbox__actions", "mechbox__error", "mechbox__result-title", "mechbox__result"].forEach(
    (className) => {
      const element = panel.querySelector(`.${className}`);
      if (element) {
        element.hidden = true;
      }
    }
  );
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-size-chain";
  root.dataset.unit = "mm";

  const formula = document.createElement("p");
  formula.className = "mechbox-size-chain__formula";
  formula.textContent = translated(
    "formula",
    "L0 = sum(increasing) − sum(decreasing); results include worst-case and RSS."
  );

  const grid = document.createElement("div");
  grid.className = "mechbox-size-chain__grid";
  const inputCard = document.createElement("section");
  inputCard.className = "mechbox-size-chain__card";
  const inputTitle = document.createElement("h3");
  inputTitle.textContent = translated("inputs_title", "Size-chain inputs");

  const closed = document.createElement("fieldset");
  closed.className = "mechbox-size-chain__closed-ring";
  const legend = document.createElement("legend");
  legend.textContent = translated("closed_ring", "Closed ring");
  const closedFields = [
    ["closed-name", translated("name", "Name"), textInput("closed-name", "间隙 L0", "mechbox-size-chain__input")],
    ["closed-min", translated("minimum", "Minimum"), numberInput("closed-min", 0.1, "mechbox-size-chain__input")],
    ["closed-max", translated("maximum", "Maximum"), numberInput("closed-max", 0.35, "mechbox-size-chain__input")],
  ];
  closed.append(legend);
  closedFields.forEach(([id, labelText, input]) => {
    const label = document.createElement("label");
    label.className = "mechbox-size-chain__field";
    label.htmlFor = id;
    input.id = id;
    label.append(document.createTextNode(labelText), input);
    closed.append(label);
  });

  const ringsTitle = document.createElement("h4");
  ringsTitle.textContent = translated("component_rings", "Component rings");
  const tableWrap = document.createElement("div");
  tableWrap.className = "mechbox-size-chain__table-wrap";
  const table = document.createElement("table");
  table.className = "mechbox-size-chain__table";
  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [
    translated("name", "Name"),
    translated("nominal_size", "Nominal size"),
    translated("total_tolerance", "Total tolerance"),
    translated("type", "Type"),
    translated("factor", "Factor"),
    translated("actions", "Actions"),
  ].forEach((labelText) => {
    const cell = document.createElement("th");
    cell.textContent = labelText;
    headerRow.append(cell);
  });
  header.append(headerRow);
  const tbody = document.createElement("tbody");
  table.append(header, tbody);
  tableWrap.append(table);

  [
    { name: "挡环厚度", nominal_size: 40, total_tolerance: 0.06, type: "decreasing", factor: 1 },
    { name: "齿轮宽度", nominal_size: 15, total_tolerance: 0.05, type: "decreasing", factor: 1 },
    { name: "轴径", nominal_size: 55.25, total_tolerance: 0.04, type: "increasing", factor: 1 },
  ].forEach((ring) => addRingRow(tbody, ring));

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn btn-default mechbox-size-chain__add-ring";
  add.textContent = translated("add_ring", "Add ring");
  add.addEventListener("click", () => addRingRow(tbody));

  const calculateButton = document.createElement("button");
  calculateButton.type = "button";
  calculateButton.className = "btn btn-primary mechbox-size-chain__calculate-btn";
  calculateButton.textContent = translated("calculate", "Calculate");
  calculateButton.addEventListener("click", () => void calculate(panel, calculateButton));

  const error = document.createElement("p");
  error.className = "mechbox-size-chain__error";
  error.hidden = true;
  inputCard.append(inputTitle, closed, ringsTitle, tableWrap, add, calculateButton, error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-size-chain__card mechbox-size-chain__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = translated("results_title", "Results");
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-size-chain__results-body";
  const empty = document.createElement("p");
  empty.className = "mechbox-size-chain__empty";
  empty.textContent = translated("results_empty", "Calculating size-chain results…");
  resultsBody.append(empty);
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputCard, resultsCard);
  root.append(formula, grid);
  mount.append(root);
  panel.dataset.mounted = "true";
  await calculate(panel, calculateButton);
}
