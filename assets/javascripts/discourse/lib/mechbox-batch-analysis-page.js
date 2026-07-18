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
  "mechbox__workbench-panel--batch-analysis",
];

const SAMPLE_CSV = `方案A,0.06,0.05,0.04
方案B,0.08,0.06,0.05
方案C,0.05,0.04,0.03
方案D,0.10,0.08,0.07
方案E,0.04,0.03,0.02`;

const ADVICE_LABELS = {
  rss_pass_worst_fail: "RSS 通过但极值失败",
  worst_pass_rss_fail: "极值通过但 RSS 失败",
  stack_method_warn: "极值/RSS 比值偏大",
  stack_method_caution: "极值/RSS 比值需注意",
};

function t(key, options) {
  return i18n(`mechbox.batch_analysis.${key}`, options);
}

function translated(key, fallback, options) {
  const value = t(key, options);
  return value.startsWith("mechbox.batch_analysis.") ? fallback : value;
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

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-batch-analysis__error");
  if (!error) {
    return;
  }
  error.hidden = !message;
  error.textContent = message || "";
}

function collectInputs(root) {
  return {
    target_min: Number(root.querySelector('[name="target-min"]').value),
    target_max: Number(root.querySelector('[name="target-max"]').value),
    pass_mode: root.querySelector('[name="pass-mode"]').value,
    csv: root.querySelector('[name="csv-input"]').value,
  };
}

function passLabel(pass) {
  return pass ? translated("pass", "通过") : translated("fail", "失败");
}

function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-batch-analysis");
  const results = root.querySelector(".mechbox-batch-analysis__results");
  results.replaceChildren();
  setError(panel, "");

  const title = document.createElement("h3");
  title.textContent = translated("results_title", "批量验证结果");
  results.append(title);

  const summary = payload.summary || {};
  const summaryGrid = document.createElement("div");
  summaryGrid.className = "mechbox-batch-analysis__summary";
  [
    [translated("summary_total", "方案数"), summary.total],
    [translated("summary_rss_pass", "RSS 通过"), summary.rss_pass],
    [translated("summary_worst_pass", "极值通过"), summary.worst_pass],
    [translated("summary_fail", "双失败"), summary.fail],
    [translated("summary_critical", "关键分歧"), summary.critical_gap],
  ].forEach(([labelText, value]) => {
    const card = document.createElement("div");
    card.className = "mechbox-batch-analysis__summary-card";
    const label = document.createElement("div");
    label.textContent = labelText;
    const strong = document.createElement("strong");
    strong.textContent = value == null ? "—" : String(value);
    card.append(label, strong);
    summaryGrid.append(card);
  });
  results.append(summaryGrid);

  const tableWrap = document.createElement("div");
  tableWrap.className = "mechbox-batch-analysis__table-wrap";
  const table = document.createElement("table");
  table.className = "mechbox-batch-analysis__table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    translated("col_name", "方案"),
    translated("col_rings", "环数"),
    translated("col_rss_tol", "RSS 公差"),
    translated("col_rss", "RSS"),
    translated("col_worst_tol", "极值公差"),
    translated("col_worst", "极值"),
    translated("col_advice", "建议"),
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");

  (payload.results || []).forEach((row) => {
    const tr = document.createElement("tr");
    if (row.error_key) {
      tr.classList.add("is-error");
    } else if (row.pass) {
      tr.classList.add("is-pass");
    } else if (row.advice_level === "critical") {
      tr.classList.add("is-critical");
    }

    const cells = row.error_key
      ? [
          row.name || "—",
          "—",
          "—",
          translated("error_no_tolerance", "无有效公差"),
          "—",
          "—",
          "—",
        ]
      : [
          row.name || "—",
          String(row.ring_count ?? "—"),
          formatNumber(row.rss_tolerance),
          passLabel(row.rss_pass),
          formatNumber(row.worst_tolerance),
          passLabel(row.worst_pass),
          row.advice_key
            ? translated(`advice_${row.advice_key}`, ADVICE_LABELS[row.advice_key] || row.advice_key)
            : "—",
        ];

    cells.forEach((text, index) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (!row.error_key && (index === 3 || index === 5)) {
        const pass = index === 3 ? row.rss_pass : row.worst_pass;
        td.classList.toggle("is-pass", !!pass);
        td.classList.toggle("is-fail", !pass);
      }
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(thead, tbody);
  tableWrap.append(table);
  results.append(tableWrap);
}

async function runCalculate(panel) {
  const root = panel.querySelector(".mechbox-batch-analysis");
  const button = root.querySelector(".mechbox-batch-analysis__calculate-btn");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = translated("calculating", "计算中…");
  setError(panel, "");

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "batch_analysis",
        save_record: false,
        inputs: collectInputs(root),
      },
    });
    renderResults(panel, result.outputs || result);
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

export async function mountBatchAnalysisWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--batch-analysis");
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
  root.className = "mechbox-batch-analysis";

  const formula = document.createElement("p");
  formula.className = "mechbox-batch-analysis__formula";
  formula.textContent = translated(
    "formula",
    "批量验证：每行一个公差方案，同时用极值法与 RSS 对照封闭环预算，并标出方法分歧。"
  );

  const grid = document.createElement("div");
  grid.className = "mechbox-batch-analysis__grid";
  const inputCard = document.createElement("section");
  inputCard.className = "mechbox-batch-analysis__card";
  const inputTitle = document.createElement("h3");
  inputTitle.textContent = translated("inputs_title", "批量验证输入");

  const target = document.createElement("div");
  target.className = "mechbox-batch-analysis__controls";
  const minField = document.createElement("label");
  minField.className = "mechbox-batch-analysis__field";
  minField.append(
    document.createTextNode(translated("target_min", "预算下限")),
    numberInput("target-min", 0, "mechbox-batch-analysis__input")
  );
  const maxField = document.createElement("label");
  maxField.className = "mechbox-batch-analysis__field";
  maxField.append(
    document.createTextNode(translated("target_max", "预算上限")),
    numberInput("target-max", 0.25, "mechbox-batch-analysis__input")
  );
  const modeField = document.createElement("label");
  modeField.className = "mechbox-batch-analysis__field";
  const mode = document.createElement("select");
  mode.name = "pass-mode";
  mode.className = "mechbox__inputs mechbox-batch-analysis__input";
  [
    ["budget", translated("mode_budget", "预算模式（推荐）")],
    ["band", translated("mode_band", "带状模式（MechBox）")],
  ].forEach(([value, labelText]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelText;
    if (value === "budget") {
      option.selected = true;
    }
    mode.append(option);
  });
  modeField.append(document.createTextNode(translated("pass_mode", "判定模式")), mode);
  target.append(minField, maxField, modeField);

  const csvHint = document.createElement("p");
  csvHint.className = "mechbox-batch-analysis__hint";
  csvHint.textContent = translated(
    "csv_hint",
    "每行：方案名,公差1,公差2,…（最多 50 行）"
  );
  const csv = document.createElement("textarea");
  csv.name = "csv-input";
  csv.className = "mechbox__inputs mechbox-batch-analysis__csv";
  csv.rows = 10;
  csv.value = SAMPLE_CSV;

  const actions = document.createElement("div");
  actions.className = "mechbox-batch-analysis__actions";
  const loadSample = document.createElement("button");
  loadSample.type = "button";
  loadSample.className = "btn btn-default";
  loadSample.textContent = translated("load_sample", "加载示例");
  loadSample.addEventListener("click", () => {
    root.querySelector('[name="target-min"]').value = 0;
    root.querySelector('[name="target-max"]').value = 0.25;
    root.querySelector('[name="pass-mode"]').value = "budget";
    csv.value = SAMPLE_CSV;
    void runCalculate(panel);
  });
  const calculate = document.createElement("button");
  calculate.type = "button";
  calculate.className = "btn btn-primary mechbox-batch-analysis__calculate-btn";
  calculate.textContent = translated("calculate", "批量验证");
  calculate.addEventListener("click", () => void runCalculate(panel));
  actions.append(loadSample, calculate);

  const error = document.createElement("p");
  error.className = "mechbox-batch-analysis__error";
  error.hidden = true;

  inputCard.append(inputTitle, target, csvHint, csv, actions, error);

  const resultCard = document.createElement("section");
  resultCard.className = "mechbox-batch-analysis__card mechbox-batch-analysis__results";
  const empty = document.createElement("p");
  empty.textContent = translated("results_empty", "粘贴 CSV 或加载示例后开始验证。");
  resultCard.append(empty);

  grid.append(inputCard, resultCard);
  root.append(formula, grid);
  mount.append(root);

  await runCalculate(panel);
}
