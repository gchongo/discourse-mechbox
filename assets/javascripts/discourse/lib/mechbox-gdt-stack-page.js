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

const TYPE_OPTIONS = [
  ["position", "位置度"],
  ["flatness", "平面度"],
  ["coaxiality", "同轴度"],
  ["parallelism", "平行度"],
  ["perpendicularity", "垂直度"],
  ["runout", "跳动"],
  ["roundness", "圆度"],
  ["straightness", "直线度"],
];

const PRESETS = {
  position: {
    typeId: "position",
    closedMax: 0.15,
    method: "rss",
    modifier: "MMC",
    autoBonus: true,
    bonus: 0,
    rings: [
      { name: "X 定位", tolerance: 0.05, direction: "right", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      { name: "Y 定位", tolerance: 0.04, direction: "up", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      {
        name: "孔径",
        tolerance: 0.02,
        direction: "right",
        factor: 0.5,
        type: "increasing",
        featureKind: "hole",
        sizeTolerance: 0.03,
      },
    ],
    datums: [
      { label: "A 底面", priority: "primary", tolerance: 0.02 },
      { label: "B 侧面", priority: "secondary", tolerance: 0.03 },
    ],
  },
  flatness: {
    typeId: "flatness",
    closedMax: 0.08,
    method: "rss",
    modifier: "RFS",
    autoBonus: true,
    bonus: 0,
    rings: [
      { name: "面1 flatness", tolerance: 0.03, direction: "", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      { name: "面2 flatness", tolerance: 0.025, direction: "", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      { name: "面3 flatness", tolerance: 0.02, direction: "", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
    ],
    datums: [],
  },
  coaxiality: {
    typeId: "coaxiality",
    closedMax: 0.05,
    method: "rss",
    modifier: "RFS",
    autoBonus: true,
    bonus: 0,
    rings: [
      { name: "外圆 runout", tolerance: 0.02, direction: "", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      { name: "内孔偏心", tolerance: 0.015, direction: "", factor: 1, type: "increasing", featureKind: "", sizeTolerance: "" },
      {
        name: "轴承径向游隙",
        tolerance: 0.008,
        direction: "",
        factor: 0.5,
        type: "increasing",
        featureKind: "",
        sizeTolerance: "",
      },
    ],
    datums: [{ label: "A 轴心", priority: "primary", tolerance: 0.01 }],
  },
};

function t(key, options) {
  return i18n(`mechbox.gdt_stack.${key}`, options);
}

function translated(key, fallback, options) {
  const value = t(key, options);
  return value.startsWith("mechbox.gdt_stack.") ? fallback : value;
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
  input.value = value === "" || value == null ? "" : value;
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
  row.className = "mechbox-gdt-stack__result-row";
  row.classList.toggle("is-danger", danger);
  const label = document.createElement("dt");
  label.textContent = labelText;
  const value = document.createElement("dd");
  value.textContent = valueText;
  row.append(label, value);
  list.append(row);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-gdt-stack__error");
  if (!error) {
    return;
  }
  error.hidden = !message;
  error.textContent = message || "";
}

function emptyRing() {
  return {
    name: "",
    tolerance: 0.01,
    direction: "",
    factor: 1,
    type: "increasing",
    featureKind: "",
    sizeTolerance: "",
  };
}

function emptyDatum() {
  return { label: "", priority: "primary", tolerance: 0.01 };
}

function syncBonusVisibility(root) {
  const modifier = root.querySelector('[name="tolerance-modifier"]').value;
  const autoBonus = root.querySelector('[name="auto-bonus"]').checked;
  const bonusField = root.querySelector(".mechbox-gdt-stack__bonus-field");
  const autoField = root.querySelector(".mechbox-gdt-stack__auto-bonus-field");
  const showModifier = modifier !== "RFS";
  autoField.hidden = !showModifier;
  bonusField.hidden = !showModifier || autoBonus;
}

function renderRingRow(tbody, ring, onChange) {
  const tr = document.createElement("tr");

  const name = textInput("ring-name", ring.name, "mechbox-gdt-stack__input");
  const tolerance = numberInput("ring-tolerance", ring.tolerance, "mechbox-gdt-stack__input");
  const factor = numberInput("ring-factor", ring.factor, "mechbox-gdt-stack__input");
  const direction = selectInput(
    "ring-direction",
    [
      ["", "—"],
      ["right", "X+"],
      ["left", "X-"],
      ["up", "Y+"],
      ["down", "Y-"],
    ],
    ring.direction || "",
    "mechbox-gdt-stack__input"
  );
  const featureKind = selectInput(
    "ring-feature",
    [
      ["", translated("feature_none", "无")],
      ["hole", translated("feature_hole", "孔")],
      ["shaft", translated("feature_shaft", "轴")],
    ],
    ring.featureKind || "",
    "mechbox-gdt-stack__input"
  );
  const sizeTolerance = numberInput(
    "ring-size-tolerance",
    ring.sizeTolerance,
    "mechbox-gdt-stack__input"
  );
  const type = selectInput(
    "ring-type",
    [
      ["increasing", translated("type_increasing", "增环 (+)")],
      ["decreasing", translated("type_decreasing", "减环 (−)")],
    ],
    ring.type || "increasing",
    "mechbox-gdt-stack__input"
  );

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-text mechbox-gdt-stack__remove";
  remove.textContent = translated("remove", "删除");
  remove.addEventListener("click", () => {
    tr.remove();
    onChange();
  });

  [name, tolerance, factor, direction, featureKind, sizeTolerance, type].forEach((input) => {
    const td = document.createElement("td");
    td.append(input);
    tr.append(td);
  });
  const actionTd = document.createElement("td");
  actionTd.append(remove);
  tr.append(actionTd);
  tbody.append(tr);
}

function renderDatumRow(tbody, datum, onChange) {
  const tr = document.createElement("tr");
  const label = textInput("datum-label", datum.label, "mechbox-gdt-stack__input");
  const priority = selectInput(
    "datum-priority",
    [
      ["primary", translated("priority_primary", "主基准")],
      ["secondary", translated("priority_secondary", "第二基准")],
      ["tertiary", translated("priority_tertiary", "第三基准")],
    ],
    datum.priority || "primary",
    "mechbox-gdt-stack__input"
  );
  const tolerance = numberInput("datum-tolerance", datum.tolerance, "mechbox-gdt-stack__input");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-text mechbox-gdt-stack__remove";
  remove.textContent = translated("remove", "删除");
  remove.addEventListener("click", () => {
    tr.remove();
    onChange();
  });

  [label, priority, tolerance].forEach((input) => {
    const td = document.createElement("td");
    td.append(input);
    tr.append(td);
  });
  const actionTd = document.createElement("td");
  actionTd.append(remove);
  tr.append(actionTd);
  tbody.append(tr);
}

function loadPreset(root, key) {
  const preset = PRESETS[key];
  if (!preset) {
    return;
  }
  root.querySelector('[name="type-id"]').value = preset.typeId;
  root.querySelector('[name="method"]').value = preset.method;
  root.querySelector('[name="closed-max"]').value = preset.closedMax;
  root.querySelector('[name="tolerance-modifier"]').value = preset.modifier;
  root.querySelector('[name="auto-bonus"]').checked = preset.autoBonus;
  root.querySelector('[name="bonus-tolerance"]').value = preset.bonus;
  syncBonusVisibility(root);

  const ringsBody = root.querySelector(".mechbox-gdt-stack__rings-body");
  const datumsBody = root.querySelector(".mechbox-gdt-stack__datums-body");
  ringsBody.replaceChildren();
  datumsBody.replaceChildren();
  const refresh = () => {};
  preset.rings.forEach((ring) => renderRingRow(ringsBody, ring, refresh));
  preset.datums.forEach((datum) => renderDatumRow(datumsBody, datum, refresh));
}

function collectInputs(root) {
  const rings = [];
  root.querySelectorAll(".mechbox-gdt-stack__rings-body tr").forEach((tr) => {
    const featureKind = tr.querySelector('[name="ring-feature"]').value;
    const sizeRaw = tr.querySelector('[name="ring-size-tolerance"]').value;
    const ring = {
      name: tr.querySelector('[name="ring-name"]').value,
      tolerance: Number(tr.querySelector('[name="ring-tolerance"]').value),
      factor: Number(tr.querySelector('[name="ring-factor"]').value),
      direction: tr.querySelector('[name="ring-direction"]').value || undefined,
      type: tr.querySelector('[name="ring-type"]').value,
    };
    if (featureKind) {
      ring.feature_kind = featureKind;
    }
    if (sizeRaw !== "") {
      ring.size_tolerance = Number(sizeRaw);
    }
    rings.push(ring);
  });

  const datums = [];
  root.querySelectorAll(".mechbox-gdt-stack__datums-body tr").forEach((tr) => {
    datums.push({
      label: tr.querySelector('[name="datum-label"]').value,
      priority: tr.querySelector('[name="datum-priority"]').value,
      tolerance: Number(tr.querySelector('[name="datum-tolerance"]').value),
    });
  });

  const modifier = root.querySelector('[name="tolerance-modifier"]').value;
  const autoBonus = root.querySelector('[name="auto-bonus"]').checked;
  const inputs = {
    type_id: root.querySelector('[name="type-id"]').value,
    method: root.querySelector('[name="method"]').value,
    closed_ring: {
      min: 0,
      max: Number(root.querySelector('[name="closed-max"]').value),
    },
    rings,
    datums,
    tolerance_modifier: modifier,
    auto_bonus: autoBonus,
  };
  if (modifier !== "RFS" && !autoBonus) {
    inputs.bonus_tolerance = Number(root.querySelector('[name="bonus-tolerance"]').value);
  }
  return inputs;
}

function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-gdt-stack");
  const results = root.querySelector(".mechbox-gdt-stack__results");
  results.replaceChildren();
  setError(panel, "");

  const title = document.createElement("h3");
  title.textContent = translated("results_title", "GD&T 公差栈结果");
  results.append(title);

  const badge = document.createElement("p");
  badge.className = "mechbox-gdt-stack__pass-badge";
  badge.classList.toggle("is-pass", !!payload.pass);
  badge.classList.toggle("is-fail", !payload.pass);
  badge.textContent = payload.pass
    ? translated("status_pass", "满足公差预算")
    : translated("status_fail", "超出公差预算");
  results.append(badge);

  const list = document.createElement("dl");
  list.className = "mechbox-gdt-stack__result-list";
  const chain = payload.chain || {};
  const modifier = payload.modifier || {};
  appendResultRow(
    list,
    translated("mode_label", "分析模式"),
    chain.mode_label || payload.type_id || "—"
  );
  appendResultRow(
    list,
    translated("total_tolerance", "栈公差"),
    `${formatNumber(chain.total_tolerance)} mm`,
    !chain.pass
  );
  appendResultRow(
    list,
    translated("effective_tolerance", "有效许用（含补偿）"),
    `${formatNumber(modifier.effective)} mm`
  );
  appendResultRow(
    list,
    translated("bonus_applied", "材料条件补偿"),
    `${formatNumber(modifier.bonus)} mm (${modifier.source || "none"})`
  );
  if (payload.datum_stack) {
    appendResultRow(
      list,
      translated("datum_total", "基准累积"),
      `${formatNumber(payload.datum_stack.total)} mm`
    );
    appendResultRow(
      list,
      translated("effective_with_datum", "含基准有效公差"),
      `${formatNumber(payload.effective_with_datum)} mm`,
      payload.pass_with_datum === false
    );
  }
  if (payload.worst_case) {
    appendResultRow(
      list,
      translated("worst_case", "极值法栈公差"),
      `${formatNumber(payload.worst_case.total_tolerance)} mm`
    );
    appendResultRow(
      list,
      translated("worst_margin", "极值裕度"),
      `${formatNumber(payload.worst_case_margin)} mm`,
      Number(payload.worst_case_margin) < 0
    );
  }
  results.append(list);

  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  if (warnings.length) {
    const warn = document.createElement("p");
    warn.className = "mechbox-gdt-stack__warning";
    warn.textContent = warnings
      .map((key) =>
        translated(`warning_${key}`, key, {
          defaultValue: key,
        })
      )
      .join("；");
    // Prefer explicit Chinese fallbacks for known keys
    const parts = [];
    if (warnings.includes("outside_budget")) {
      parts.push(translated("warning_outside_budget", "栈公差超出封闭环预算"));
    }
    if (warnings.includes("datum_fail")) {
      parts.push(translated("warning_datum_fail", "计入基准后超出预算"));
    }
    if (warnings.includes("worst_fail")) {
      parts.push(translated("warning_worst_fail", "极值法不满足预算"));
    }
    warn.textContent = parts.join("；") || warnings.join(", ");
    results.append(warn);
  }

  const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
  if (contributions.length) {
    const contribTitle = document.createElement("h4");
    contribTitle.textContent = translated("contributions", "公差贡献度");
    results.append(contribTitle);
    contributions.forEach((item) => {
      const row = document.createElement("div");
      row.className = "mechbox-gdt-stack__contribution-row";
      const name = document.createElement("span");
      name.textContent = item.name || "—";
      const bar = document.createElement("div");
      bar.className = "mechbox-gdt-stack__contribution-bar";
      const fill = document.createElement("div");
      fill.className = "mechbox-gdt-stack__contribution-fill";
      fill.style.width = `${Math.min(100, Math.max(0, Number(item.percent) || 0))}%`;
      bar.append(fill);
      const percent = document.createElement("span");
      percent.textContent = `${formatNumber(item.percent, 1)}%`;
      row.append(name, bar, percent);
      results.append(row);
    });
  }
}

async function runCalculate(panel) {
  const root = panel.querySelector(".mechbox-gdt-stack");
  const button = root.querySelector(".mechbox-gdt-stack__calculate-btn");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = translated("calculating", "计算中…");
  setError(panel, "");

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "gdt_stack",
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

export async function mountGdtStackWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--gdt-stack");
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
  root.className = "mechbox-gdt-stack";

  const formula = document.createElement("p");
  formula.className = "mechbox-gdt-stack__formula";
  formula.textContent = translated(
    "formula",
    "GD&T 公差栈：位置度 2D 合成、形位/径向 RSS 叠加，可计入基准与 MMC/LMC 补偿。"
  );

  const presets = document.createElement("div");
  presets.className = "mechbox-gdt-stack__presets";
  [
    ["position", translated("preset_position", "孔组位置度")],
    ["flatness", translated("preset_flatness", "平面度栈")],
    ["coaxiality", translated("preset_coaxiality", "同轴度栈")],
  ].forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-default mechbox-gdt-stack__preset-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      loadPreset(root, key);
      void runCalculate(panel);
    });
    presets.append(btn);
  });

  const grid = document.createElement("div");
  grid.className = "mechbox-gdt-stack__grid";
  const inputCard = document.createElement("section");
  inputCard.className = "mechbox-gdt-stack__card";
  const inputTitle = document.createElement("h3");
  inputTitle.textContent = translated("inputs_title", "GD&T 栈输入");

  const controls = document.createElement("div");
  controls.className = "mechbox-gdt-stack__controls";

  const typeField = document.createElement("label");
  typeField.className = "mechbox-gdt-stack__field";
  typeField.append(
    document.createTextNode(translated("type_id", "分析类型")),
    selectInput(
      "type-id",
      TYPE_OPTIONS.map(([id, label]) => [id, translated(`type_${id}`, label)]),
      "position",
      "mechbox-gdt-stack__input"
    )
  );

  const methodField = document.createElement("label");
  methodField.className = "mechbox-gdt-stack__field";
  methodField.append(
    document.createTextNode(translated("method", "叠代方法")),
    selectInput(
      "method",
      [
        ["rss", "RSS"],
        ["worst", translated("method_worst", "极值法")],
      ],
      "rss",
      "mechbox-gdt-stack__input"
    )
  );

  const closedField = document.createElement("label");
  closedField.className = "mechbox-gdt-stack__field";
  closedField.append(
    document.createTextNode(translated("closed_max", "公差预算上限 (mm)")),
    numberInput("closed-max", 0.15, "mechbox-gdt-stack__input")
  );

  const modifierField = document.createElement("label");
  modifierField.className = "mechbox-gdt-stack__field";
  const modifierSelect = selectInput(
    "tolerance-modifier",
    [
      ["RFS", "RFS"],
      ["MMC", "MMC"],
      ["LMC", "LMC"],
    ],
    "MMC",
    "mechbox-gdt-stack__input"
  );
  modifierSelect.addEventListener("change", () => syncBonusVisibility(root));
  modifierField.append(
    document.createTextNode(translated("tolerance_modifier", "材料条件")),
    modifierSelect
  );

  const autoField = document.createElement("label");
  autoField.className = "mechbox-gdt-stack__field mechbox-gdt-stack__auto-bonus-field";
  const autoBonus = document.createElement("input");
  autoBonus.type = "checkbox";
  autoBonus.name = "auto-bonus";
  autoBonus.checked = true;
  autoBonus.className = "mechbox-gdt-stack__checkbox";
  autoBonus.addEventListener("change", () => syncBonusVisibility(root));
  autoField.append(autoBonus, document.createTextNode(translated("auto_bonus", "自动计算补偿")));

  const bonusField = document.createElement("label");
  bonusField.className = "mechbox-gdt-stack__field mechbox-gdt-stack__bonus-field";
  bonusField.append(
    document.createTextNode(translated("bonus_tolerance", "手动补偿 (mm)")),
    numberInput("bonus-tolerance", 0, "mechbox-gdt-stack__input")
  );

  controls.append(typeField, methodField, closedField, modifierField, autoField, bonusField);

  const ringsTitle = document.createElement("h4");
  ringsTitle.textContent = translated("rings", "组成环");
  const ringsWrap = document.createElement("div");
  ringsWrap.className = "mechbox-gdt-stack__table-wrap";
  const ringsTable = document.createElement("table");
  ringsTable.className = "mechbox-gdt-stack__table";
  const ringsHead = document.createElement("thead");
  const ringsHeadRow = document.createElement("tr");
  [
    translated("ring_name", "名称"),
    translated("tolerance", "公差"),
    translated("factor", "系数"),
    translated("direction", "方向"),
    translated("feature_kind", "特征"),
    translated("size_tolerance", "尺寸公差"),
    translated("ring_type", "环类型"),
    translated("actions", "操作"),
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    ringsHeadRow.append(th);
  });
  ringsHead.append(ringsHeadRow);
  const ringsBody = document.createElement("tbody");
  ringsBody.className = "mechbox-gdt-stack__rings-body";
  ringsTable.append(ringsHead, ringsBody);
  ringsWrap.append(ringsTable);

  const addRing = document.createElement("button");
  addRing.type = "button";
  addRing.className = "btn btn-default";
  addRing.textContent = translated("add_ring", "添加组成环");
  addRing.addEventListener("click", () => renderRingRow(ringsBody, emptyRing(), () => {}));

  const datumsTitle = document.createElement("h4");
  datumsTitle.textContent = translated("datums", "基准");
  const datumsWrap = document.createElement("div");
  datumsWrap.className = "mechbox-gdt-stack__table-wrap";
  const datumsTable = document.createElement("table");
  datumsTable.className = "mechbox-gdt-stack__table";
  const datumsHead = document.createElement("thead");
  const datumsHeadRow = document.createElement("tr");
  [
    translated("datum_label", "基准"),
    translated("priority", "优先级"),
    translated("tolerance", "公差"),
    translated("actions", "操作"),
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    datumsHeadRow.append(th);
  });
  datumsHead.append(datumsHeadRow);
  const datumsBody = document.createElement("tbody");
  datumsBody.className = "mechbox-gdt-stack__datums-body";
  datumsTable.append(datumsHead, datumsBody);
  datumsWrap.append(datumsTable);

  const addDatum = document.createElement("button");
  addDatum.type = "button";
  addDatum.className = "btn btn-default";
  addDatum.textContent = translated("add_datum", "添加基准");
  addDatum.addEventListener("click", () => renderDatumRow(datumsBody, emptyDatum(), () => {}));

  const calculate = document.createElement("button");
  calculate.type = "button";
  calculate.className = "btn btn-primary mechbox-gdt-stack__calculate-btn";
  calculate.textContent = translated("calculate", "计算公差栈");
  calculate.addEventListener("click", () => void runCalculate(panel));

  const error = document.createElement("p");
  error.className = "mechbox-gdt-stack__error";
  error.hidden = true;

  inputCard.append(
    inputTitle,
    controls,
    ringsTitle,
    ringsWrap,
    addRing,
    datumsTitle,
    datumsWrap,
    addDatum,
    calculate,
    error
  );

  const resultCard = document.createElement("section");
  resultCard.className = "mechbox-gdt-stack__card mechbox-gdt-stack__results";
  const empty = document.createElement("p");
  empty.textContent = translated("results_empty", "选择预设或填写参数后计算。");
  resultCard.append(empty);

  grid.append(inputCard, resultCard);
  root.append(formula, presets, grid);
  mount.append(root);

  loadPreset(root, "position");
  syncBonusVisibility(root);
  await runCalculate(panel);
}
