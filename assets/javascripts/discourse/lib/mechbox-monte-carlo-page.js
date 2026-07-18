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

const GEAR_CASE = {
  closedName: "间隙 L0",
  closedMin: 0.1,
  closedMax: 0.35,
  rings: [
    { name: "挡环厚度", size: 40, tolerance: 0.06, type: "decreasing", factor: 1 },
    { name: "齿轮宽度", size: 15, tolerance: 0.05, type: "decreasing", factor: 1 },
    { name: "轴径", size: 55.25, tolerance: 0.04, type: "increasing", factor: 1 },
  ],
};

function t(key, options) {
  return i18n(`mechbox.monte_carlo.${key}`, options);
}

function translated(key, fallback, options) {
  const value = t(key, options);
  return value.startsWith("mechbox.monte_carlo.") ? fallback : value;
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
  input.value = value ?? "";
  input.autocomplete = "off";
  input.className = `mechbox__inputs ${className}`;
  return input;
}

function selectInput(name, options, value, className) {
  const select = document.createElement("select");
  select.name = name;
  select.className = `mechbox__inputs ${className}`;
  options.forEach(([optValue, label]) => {
    const option = document.createElement("option");
    option.value = optValue;
    option.textContent = label;
    if (String(optValue) === String(value)) {
      option.selected = true;
    }
    select.append(option);
  });
  return select;
}

function appendResultRow(list, labelText, valueText, danger = false) {
  const row = document.createElement("div");
  row.className = "mechbox-monte-carlo__result-row";
  row.classList.toggle("is-danger", danger);
  const label = document.createElement("dt");
  label.textContent = labelText;
  const value = document.createElement("dd");
  value.textContent = valueText;
  row.append(label, value);
  list.append(row);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-monte-carlo__error");
  if (!error) {
    return;
  }
  error.hidden = !message;
  error.textContent = message || "";
}

function emptyRing() {
  return { name: "", size: 10, tolerance: 0.05, type: "increasing", factor: 1 };
}

function renderRingRow(tbody, ring) {
  const tr = document.createElement("tr");
  const name = textInput("ring-name", ring.name, "mechbox-monte-carlo__input");
  const size = numberInput("ring-size", ring.size, "mechbox-monte-carlo__input");
  const tolerance = numberInput("ring-tolerance", ring.tolerance, "mechbox-monte-carlo__input");
  const type = selectInput(
    "ring-type",
    [
      ["increasing", translated("type_increasing", "增环 (+)")],
      ["decreasing", translated("type_decreasing", "减环 (−)")],
    ],
    ring.type || "increasing",
    "mechbox-monte-carlo__input"
  );
  const factor = numberInput("ring-factor", ring.factor ?? 1, "mechbox-monte-carlo__input");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-text mechbox-monte-carlo__remove";
  remove.textContent = translated("remove", "删除");
  remove.addEventListener("click", () => tr.remove());

  [name, size, tolerance, type, factor].forEach((input) => {
    const td = document.createElement("td");
    td.append(input);
    tr.append(td);
  });
  const actionTd = document.createElement("td");
  actionTd.append(remove);
  tr.append(actionTd);
  tbody.append(tr);
}

function loadGearCase(root) {
  root.querySelector('[name="closed-name"]').value = GEAR_CASE.closedName;
  root.querySelector('[name="closed-min"]').value = GEAR_CASE.closedMin;
  root.querySelector('[name="closed-max"]').value = GEAR_CASE.closedMax;
  root.querySelector('[name="distribution"]').value = "normal";
  root.querySelector('[name="custom-k"]').value = 0;
  root.querySelector('[name="truncated-normal"]').checked = true;
  root.querySelector('[name="iterations"]').value = 10000;
  root.querySelector('[name="seed"]').value = 42;
  root.querySelector('[name="include-sensitivity"]').checked = true;
  const tbody = root.querySelector(".mechbox-monte-carlo__rings-body");
  tbody.replaceChildren();
  GEAR_CASE.rings.forEach((ring) => renderRingRow(tbody, ring));
}

function collectInputs(root) {
  const rings = [];
  root.querySelectorAll(".mechbox-monte-carlo__rings-body tr").forEach((tr) => {
    rings.push({
      name: tr.querySelector('[name="ring-name"]').value,
      size: Number(tr.querySelector('[name="ring-size"]').value),
      tolerance: Number(tr.querySelector('[name="ring-tolerance"]').value),
      type: tr.querySelector('[name="ring-type"]').value,
      factor: Number(tr.querySelector('[name="ring-factor"]').value),
    });
  });

  return {
    closed_ring: {
      name: root.querySelector('[name="closed-name"]').value,
      min: Number(root.querySelector('[name="closed-min"]').value),
      max: Number(root.querySelector('[name="closed-max"]').value),
    },
    component_rings: rings,
    distribution: root.querySelector('[name="distribution"]').value,
    custom_k: Number(root.querySelector('[name="custom-k"]').value),
    truncated_normal: root.querySelector('[name="truncated-normal"]').checked,
    iterations: Number(root.querySelector('[name="iterations"]').value),
    seed: Number(root.querySelector('[name="seed"]').value),
    include_sensitivity: root.querySelector('[name="include-sensitivity"]').checked,
  };
}

function renderHistogram(container, bins) {
  const title = document.createElement("h4");
  title.textContent = translated("histogram", "分布直方图");
  container.append(title);
  if (!Array.isArray(bins) || !bins.length) {
    return;
  }
  const maxCount = Math.max(...bins.map((bin) => Number(bin.count) || 0), 1);
  const chart = document.createElement("div");
  chart.className = "mechbox-monte-carlo__histogram";
  bins.forEach((bin) => {
    const col = document.createElement("div");
    col.className = "mechbox-monte-carlo__hist-col";
    const bar = document.createElement("div");
    bar.className = "mechbox-monte-carlo__hist-bar";
    bar.style.height = `${Math.max(2, ((Number(bin.count) || 0) / maxCount) * 100)}%`;
    bar.title = `${formatNumber(bin.x0)}–${formatNumber(bin.x1)}: ${bin.count}`;
    col.append(bar);
    chart.append(col);
  });
  container.append(chart);
}

function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-monte-carlo");
  const results = root.querySelector(".mechbox-monte-carlo__results");
  results.replaceChildren();
  setError(panel, "");

  const title = document.createElement("h3");
  title.textContent = translated("results_title", "Monte Carlo 结果");
  results.append(title);

  const badge = document.createElement("p");
  badge.className = "mechbox-monte-carlo__pass-badge";
  const passRate = Number(payload.pass_rate) || 0;
  badge.classList.toggle("is-pass", passRate >= 0.95);
  badge.classList.toggle("is-fail", passRate < 0.95);
  badge.textContent = `${translated("pass_rate", "通过率")} ${(passRate * 100).toFixed(2)}%`;
  results.append(badge);

  const list = document.createElement("dl");
  list.className = "mechbox-monte-carlo__result-list";
  appendResultRow(list, translated("mean", "均值"), `${formatNumber(payload.mean)} mm`);
  appendResultRow(list, translated("std", "标准差"), `${formatNumber(payload.std)} mm`);
  appendResultRow(list, translated("min", "最小"), `${formatNumber(payload.min)} mm`);
  appendResultRow(list, translated("max", "最大"), `${formatNumber(payload.max)} mm`);
  appendResultRow(
    list,
    translated("percentiles", "P05 / P50 / P95"),
    `${formatNumber(payload.p05)} / ${formatNumber(payload.p50)} / ${formatNumber(payload.p95)}`
  );
  appendResultRow(
    list,
    translated("iterations", "迭代次数"),
    String(payload.iterations ?? "—")
  );
  results.append(list);

  if (payload.worst || payload.rss) {
    const compare = document.createElement("div");
    compare.className = "mechbox-monte-carlo__method-grid";
    [
      ["worst", translated("worst_case", "极值法"), payload.worst],
      ["rss", translated("rss", "RSS"), payload.rss],
    ].forEach(([, label, method]) => {
      if (!method) {
        return;
      }
      const card = document.createElement("div");
      card.className = "mechbox-monte-carlo__method-card";
      card.classList.toggle("is-pass", !!method.pass);
      card.classList.toggle("is-fail", !method.pass);
      const h = document.createElement("h4");
      h.textContent = label;
      const tol = document.createElement("p");
      tol.textContent = `${translated("total_tolerance", "总公差")} ${formatNumber(method.total_tolerance)} mm`;
      const status = document.createElement("p");
      status.textContent = method.pass
        ? translated("status_pass", "满足")
        : translated("status_fail", "不满足");
      card.append(h, tol, status);
      compare.append(card);
    });
    results.append(compare);
  }

  renderHistogram(results, payload.histogram);

  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  if (warnings.length) {
    const warn = document.createElement("p");
    warn.className = "mechbox-monte-carlo__warning";
    const parts = [];
    if (warnings.includes("rss_pass_worst_fail")) {
      parts.push(translated("warning_rss_pass_worst_fail", "RSS 通过但极值法失败"));
    }
    if (warnings.includes("mc_pass_worst_fail")) {
      parts.push(translated("warning_mc_pass_worst_fail", "Monte Carlo 通过率高，但极值法未满足"));
    }
    if (warnings.includes("low_pass_rate")) {
      parts.push(translated("warning_low_pass_rate", "通过率低于 95%"));
    }
    warn.textContent = parts.join("；") || warnings.join(", ");
    results.append(warn);
  }

  const sensitivity = payload.sensitivity;
  if (sensitivity?.items?.length) {
    const sensTitle = document.createElement("h4");
    sensTitle.textContent = translated("sensitivity", "敏感度（龙卷风）");
    results.append(sensTitle);
    if (sensitivity.top_contributor) {
      const top = document.createElement("p");
      top.className = "mechbox-monte-carlo__top-contributor";
      top.textContent = `${translated("top_contributor", "最大贡献")}：${sensitivity.top_contributor}`;
      results.append(top);
    }
    sensitivity.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "mechbox-monte-carlo__contribution-row";
      const name = document.createElement("span");
      name.textContent = item.name || "—";
      const bar = document.createElement("div");
      bar.className = "mechbox-monte-carlo__contribution-bar";
      const fill = document.createElement("div");
      fill.className = "mechbox-monte-carlo__contribution-fill";
      fill.style.width = `${Math.min(100, Math.max(0, Number(item.variance_pct) || 0))}%`;
      bar.append(fill);
      const meta = document.createElement("span");
      meta.textContent = `${formatNumber(item.variance_pct, 1)}% · Δ${formatNumber(item.spread)}`;
      row.append(name, bar, meta);
      results.append(row);
    });
  }
}

async function runCalculate(panel) {
  const root = panel.querySelector(".mechbox-monte-carlo");
  const button = root.querySelector(".mechbox-monte-carlo__calculate-btn");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = translated("calculating", "计算中…");
  setError(panel, "");

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "monte_carlo",
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

export async function mountMonteCarloWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--monte-carlo");
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
  root.className = "mechbox-monte-carlo";

  const formula = document.createElement("p");
  formula.className = "mechbox-monte-carlo__formula";
  formula.textContent = translated(
    "formula",
    "Monte Carlo 尺寸链：按分布随机抽样组成环，统计封闭环通过率，并对照极值/RSS。"
  );

  const grid = document.createElement("div");
  grid.className = "mechbox-monte-carlo__grid";
  const inputCard = document.createElement("section");
  inputCard.className = "mechbox-monte-carlo__card";
  const inputTitle = document.createElement("h3");
  inputTitle.textContent = translated("inputs_title", "Monte Carlo 输入");

  const closed = document.createElement("fieldset");
  closed.className = "mechbox-monte-carlo__closed";
  const legend = document.createElement("legend");
  legend.textContent = translated("closed_ring", "封闭环要求");
  closed.append(legend);
  [
    ["closed-name", translated("closed_name", "名称"), textInput("closed-name", "", "mechbox-monte-carlo__input")],
    ["closed-min", translated("closed_min", "最小值"), numberInput("closed-min", 0.1, "mechbox-monte-carlo__input")],
    ["closed-max", translated("closed_max", "最大值"), numberInput("closed-max", 0.35, "mechbox-monte-carlo__input")],
  ].forEach(([id, labelText, input]) => {
    const label = document.createElement("label");
    label.className = "mechbox-monte-carlo__field";
    label.htmlFor = id;
    input.id = id;
    label.append(document.createTextNode(labelText), input);
    closed.append(label);
  });

  const controls = document.createElement("div");
  controls.className = "mechbox-monte-carlo__controls";
  const distField = document.createElement("label");
  distField.className = "mechbox-monte-carlo__field";
  distField.append(
    document.createTextNode(translated("distribution", "分布")),
    selectInput(
      "distribution",
      [
        ["normal", translated("dist_normal", "正态")],
        ["uniform", translated("dist_uniform", "均匀")],
        ["triangular", translated("dist_triangular", "三角")],
        ["skewed", translated("dist_skewed", "偏态")],
      ],
      "normal",
      "mechbox-monte-carlo__input"
    )
  );
  const kField = document.createElement("label");
  kField.className = "mechbox-monte-carlo__field";
  kField.append(
    document.createTextNode(translated("custom_k", "自定义 K（0=默认）")),
    numberInput("custom-k", 0, "mechbox-monte-carlo__input")
  );
  const iterField = document.createElement("label");
  iterField.className = "mechbox-monte-carlo__field";
  iterField.append(
    document.createTextNode(translated("iterations", "迭代次数")),
    numberInput("iterations", 10000, "mechbox-monte-carlo__input")
  );
  const seedField = document.createElement("label");
  seedField.className = "mechbox-monte-carlo__field";
  seedField.append(
    document.createTextNode(translated("seed", "随机种子")),
    numberInput("seed", 42, "mechbox-monte-carlo__input")
  );
  const truncField = document.createElement("label");
  truncField.className = "mechbox-monte-carlo__field mechbox-monte-carlo__check-field";
  const trunc = document.createElement("input");
  trunc.type = "checkbox";
  trunc.name = "truncated-normal";
  trunc.checked = true;
  truncField.append(trunc, document.createTextNode(translated("truncated_normal", "截断正态")));
  const sensField = document.createElement("label");
  sensField.className = "mechbox-monte-carlo__field mechbox-monte-carlo__check-field";
  const sens = document.createElement("input");
  sens.type = "checkbox";
  sens.name = "include-sensitivity";
  sens.checked = true;
  sensField.append(sens, document.createTextNode(translated("include_sensitivity", "敏感度分析")));
  controls.append(distField, kField, iterField, seedField, truncField, sensField);

  const ringsTitle = document.createElement("h4");
  ringsTitle.textContent = translated("rings", "组成环");
  const tableWrap = document.createElement("div");
  tableWrap.className = "mechbox-monte-carlo__table-wrap";
  const table = document.createElement("table");
  table.className = "mechbox-monte-carlo__table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    translated("ring_name", "名称"),
    translated("size", "名义尺寸"),
    translated("tolerance", "公差"),
    translated("ring_type", "环类型"),
    translated("factor", "系数"),
    translated("actions", "操作"),
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  tbody.className = "mechbox-monte-carlo__rings-body";
  table.append(thead, tbody);
  tableWrap.append(table);

  const addRing = document.createElement("button");
  addRing.type = "button";
  addRing.className = "btn btn-default";
  addRing.textContent = translated("add_ring", "添加组成环");
  addRing.addEventListener("click", () => renderRingRow(tbody, emptyRing()));

  const loadCase = document.createElement("button");
  loadCase.type = "button";
  loadCase.className = "btn btn-default";
  loadCase.textContent = translated("load_gear_case", "加载齿轮间隙案例");
  loadCase.addEventListener("click", () => {
    loadGearCase(root);
    void runCalculate(panel);
  });

  const calculate = document.createElement("button");
  calculate.type = "button";
  calculate.className = "btn btn-primary mechbox-monte-carlo__calculate-btn";
  calculate.textContent = translated("calculate", "运行模拟");
  calculate.addEventListener("click", () => void runCalculate(panel));

  const error = document.createElement("p");
  error.className = "mechbox-monte-carlo__error";
  error.hidden = true;

  inputCard.append(
    inputTitle,
    closed,
    controls,
    ringsTitle,
    tableWrap,
    addRing,
    loadCase,
    calculate,
    error
  );

  const resultCard = document.createElement("section");
  resultCard.className = "mechbox-monte-carlo__card mechbox-monte-carlo__results";
  const empty = document.createElement("p");
  empty.textContent = translated("results_empty", "填写参数后运行 Monte Carlo 模拟。");
  resultCard.append(empty);

  grid.append(inputCard, resultCard);
  root.append(formula, grid);
  mount.append(root);

  loadGearCase(root);
  await runCalculate(panel);
}
