import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

const CATALOG_SYSTEMS = [
  { id: "metric", subSeries: "coarse", label: "ISO 公制粗牙 M", title: "ISO 公制粗牙 M" },
  { id: "metric", subSeries: "fine", label: "ISO 公制细牙 M", title: "ISO 公制细牙 M" },
  { id: "unc", subSeries: "", label: "UNC 统一粗牙", title: "UNC 统一粗牙" },
  { id: "unf", subSeries: "", label: "UNF 统一细牙", title: "UNF 统一细牙" },
  { id: "unef", subSeries: "", label: "UNEF 统一特细牙", title: "UNEF 统一特细牙" },
  { id: "tr", subSeries: "", label: "Tr 梯形螺纹", title: "Tr 梯形螺纹" },
  { id: "acme", subSeries: "", label: "Acme 梯形螺纹", title: "Acme 梯形螺纹" },
  { id: "npt", subSeries: "", label: "NPT 管螺纹", title: "NPT 管螺纹" },
  { id: "nptf", subSeries: "", label: "NPTF 干密封管螺纹", title: "NPTF 干密封管螺纹" },
  { id: "g", subSeries: "", label: "G (BSPP) 管螺纹", title: "G (BSPP) 管螺纹" },
  { id: "r", subSeries: "", label: "R (BSPT) 管螺纹", title: "R (BSPT) 管螺纹" },
  { id: "uns", subSeries: "", label: "UNS 特殊系列", title: "UNS 特殊统一螺纹系列" },
  { id: "bsw", subSeries: "bsw", label: "BSW 惠氏粗牙", title: "BSW 惠氏粗牙" },
  { id: "bsf", subSeries: "bsf", label: "BSF 惠氏细牙", title: "BSF 惠氏细牙" },
];

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
];

function t(key, options) {
  return i18n(`mechbox.thread_table.${key}`, options);
}

function translated(key, fallback, options) {
  const value = t(key, options);
  return value.startsWith("mechbox.thread_table.") ? fallback : value;
}

function formatNumber(value, digits = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function textInput(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "mechbox__inputs mechbox-thread-table__input";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";
  return input;
}

function selectInput(name, options, value) {
  const select = document.createElement("select");
  select.className = "mechbox__inputs mechbox-thread-table__select";
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

function collectInputs(root) {
  return {
    query: root.querySelector('input[name="query"]')?.value || "",
    priority: root.querySelector('select[name="priority"]')?.value || "all",
    system: root.dataset.system || "metric",
    sub_series: root.dataset.subSeries || "",
    page: Number(root.dataset.page || 1),
  };
}

function formatPitchOrTpi(row) {
  if (row.tpi != null && row.tpi !== "") {
    return `${formatNumber(row.tpi, 0)} TPI`;
  }
  if (row.pitch != null && row.pitch !== "") {
    return formatNumber(row.pitch, 3);
  }
  return "—";
}

function formatPitchDia(row) {
  const value = row.pitchDia ?? row.pitchDiameter;
  if (value == null || value === "") {
    return "—";
  }
  return formatNumber(value, 3);
}

function appendCell(row, value, tagName = "td") {
  const cell = document.createElement(tagName);
  cell.textContent = value;
  row.append(cell);
}

function tolerancePair(row) {
  const external = row.toleranceExternal;
  const internal = row.toleranceInternal;
  return [external, internal].filter((value) => value && value !== "—").join(" / ") || "—";
}

function renderResultsTable(rows, isMetric) {
  const table = document.createElement("table");
  table.className = "mechbox-thread-table__table";
  const hasTapDrill = rows.some((row) => row.tapDrill != null && row.tapDrill !== "");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [
    translated("col_designation", "Designation"),
    ...(isMetric ? [translated("col_priority", "Priority")] : []),
    translated("col_pitch", "Pitch / TPI"),
    translated("col_major", "Major diameter"),
    translated("col_pitch_dia", "Pitch diameter"),
    translated("col_minor", "Minor diameter"),
    ...(hasTapDrill ? [translated("col_tap_drill", "Tap drill")] : []),
    "公差",
  ];
  headers.forEach((header) => appendCell(headerRow, header, "th"));
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  (rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    appendCell(tr, row.designation ?? "—");
    if (isMetric) {
      appendCell(tr, row.priority ?? "—");
    }
    appendCell(tr, formatPitchOrTpi(row));
    appendCell(tr, formatNumber(row.major, 3));
    appendCell(tr, formatPitchDia(row));
    appendCell(tr, formatNumber(row.minor, 3));
    if (hasTapDrill) {
      appendCell(tr, formatNumber(row.tapDrill, 3));
    }
    appendCell(tr, tolerancePair(row));
    tbody.append(tr);
  });

  table.append(thead, tbody);
  return table;
}

function selectedSystem(root) {
  return CATALOG_SYSTEMS.find(
    ({ id, subSeries }) => id === root.dataset.system && subSeries === root.dataset.subSeries
  ) || CATALOG_SYSTEMS[0];
}

function updateCatalogCopy(root) {
  const system = selectedSystem(root);
  const isMetric = system.id === "metric";
  root.querySelector(".mechbox-thread-table__breadcrumb-system").textContent = system.label;
  root.querySelector(".mechbox-thread-table__meta-title").textContent = system.title;
  root.querySelector(".mechbox-thread-table__series-title").textContent = system.title;
  root.querySelector(".mechbox-thread-table__unit").textContent =
    ["unc", "unf", "unef", "acme", "npt", "nptf", "g", "r", "uns", "bsw", "bsf"].includes(
      system.id
    )
      ? "in"
      : "mm";
  root.querySelector(".mechbox-thread-table__priority-filter").hidden = !isMetric;
}

async function renderResults(panel, payload) {
  const root = panel.querySelector(".mechbox-thread-table");
  const box = panel.querySelector(".mechbox-thread-table__results-body");
  if (!box || !root) {
    return;
  }

  const outputs = payload?.outputs || {};
  const rows = outputs.rows || [];
  const page = outputs.page || 1;
  const pageCount = outputs.page_count || 1;
  root.dataset.page = page;

  box.replaceChildren();
  box.classList.add("is-visible");

  const summary = document.createElement("p");
  summary.className = "mechbox-thread-table__summary";
  summary.textContent = `共 ${outputs.matched_count ?? outputs.count ?? rows.length} 条`;
  box.append(summary);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "mechbox-thread-table__empty";
    empty.textContent = t("results_none");
    box.append(empty);
    return;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "mechbox-thread-table__table-wrap mechbox-thread-table__scroll-host";
  tableWrap.append(renderResultsTable(rows, root.dataset.system === "metric"));
  box.append(tableWrap);

  if (pageCount > 1) {
    const pagination = document.createElement("nav");
    pagination.className = "mechbox-thread-table__pagination";
    pagination.setAttribute("aria-label", t("pagination_label"));

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn btn-default mechbox-thread-table__page-btn";
    previous.textContent = t("previous_page");
    previous.disabled = page === 1;
    previous.addEventListener("click", () => {
      root.dataset.page = page - 1;
      void loadThreadCatalog(panel);
    });

    const current = document.createElement("span");
    current.className = "mechbox-thread-table__page-status";
    current.textContent = t("page_status", { page, total: pageCount });

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-default mechbox-thread-table__page-btn";
    next.textContent = t("next_page");
    next.disabled = page === pageCount;
    next.addEventListener("click", () => {
      root.dataset.page = page + 1;
      void loadThreadCatalog(panel);
    });

    pagination.append(previous, current, next);
    box.append(pagination);
  }
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-thread-table__error");
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

async function loadThreadCatalog(panel, { resetPage = false } = {}) {
  const root = panel.querySelector(".mechbox-thread-table");
  if (!root) {
    return;
  }

  if (resetPage) {
    root.dataset.page = "1";
  }

  const button = root.querySelector(".mechbox-thread-table__search-btn");
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = i18n("mechbox.calculating");
  }
  setError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: "thread_table",
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
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

function metaEntries(system) {
  if (system.id === "metric") {
    return [
      ["用途", "紧固件通用螺纹"],
      ["牙型", "三角形"],
      ["牙型角", "60°"],
      ["旋向", "右旋"],
      ["公称尺寸", "M 系列"],
      ["螺距", system.subSeries === "fine" ? "细牙系列" : "粗牙系列"],
      ["公差", "6g / 6H（常用）"],
      ["标准", "ISO 724 / ISO 965 / ISO 68-1"],
    ];
  }
  const imperial = ["unc", "unf", "unef", "acme", "npt", "nptf", "g", "r", "uns", "bsw", "bsf"].includes(
    system.id
  );
  return [
    ["用途", system.id.includes("n") || system.id === "g" || system.id === "r" ? "管路连接" : "机械连接"],
    ["牙型", system.id === "tr" || system.id === "acme" ? "梯形" : "三角形"],
    ["牙型角", system.id === "acme" ? "29°" : system.id === "tr" ? "30°" : "60°"],
    ["旋向", "右旋"],
    ["尺寸单位", imperial ? "in / TPI" : "mm"],
    ["标准", imperial ? "ASME B1.1" : "相关产品标准"],
  ];
}

function makeMetaGrid(system) {
  const grid = document.createElement("dl");
  grid.className = "mechbox-thread-table__meta-grid";
  metaEntries(system).forEach(([labelText, valueText]) => {
    const item = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = labelText;
    value.textContent = valueText;
    item.append(label, value);
    grid.append(item);
  });
  return grid;
}

export async function mountThreadTableWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(...WORKBENCH_PANEL_CLASSES);
  panel.classList.add("mechbox__workbench-panel--thread-table");

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
  root.className = "mechbox-thread-table mechbox-thread-table__library";
  root.dataset.page = "1";
  root.dataset.system = "metric";
  root.dataset.subSeries = "coarse";

  const shell = document.createElement("div");
  shell.className = "mechbox-thread-table__shell";
  const sidebar = document.createElement("aside");
  sidebar.className = "mechbox-thread-table__sidebar";
  sidebar.setAttribute("aria-label", "Thread standards navigation");

  [
    ["📋 规格库", "▾", true],
  ].forEach(([labelText, marker]) => {
    const heading = document.createElement("div");
    heading.className = "mechbox-thread-table__nav-heading";
    heading.textContent = `${marker} ${labelText}`;
    sidebar.append(heading);
  });
  const catalog = document.createElement("div");
  catalog.className = "mechbox-thread-table__catalog";
  const category = document.createElement("div");
  category.className = "mechbox-thread-table__nav-category";
  category.textContent = "紧固螺纹";
  catalog.append(category);
  CATALOG_SYSTEMS.forEach((system) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mechbox-thread-table__nav-item";
    item.dataset.system = system.id;
    item.dataset.subSeries = system.subSeries;
    item.textContent = system.label;
    item.addEventListener("click", () => {
      root.dataset.system = system.id;
      root.dataset.subSeries = system.subSeries;
      root.dataset.page = "1";
      catalog.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("is-active", button === item);
      });
      updateCatalogCopy(root);
      const meta = root.querySelector(".mechbox-thread-table__meta-grid");
      meta.replaceWith(makeMetaGrid(system));
      void loadThreadCatalog(panel);
    });
    catalog.append(item);
  });
  sidebar.append(catalog);
  ["▸ 设计制造", "▸ 解析对照"].forEach((labelText) => {
    const heading = document.createElement("div");
    heading.className = "mechbox-thread-table__nav-heading mechbox-thread-table__nav-heading--collapsed";
    heading.textContent = labelText;
    sidebar.append(heading);
  });

  const main = document.createElement("main");
  main.className = "mechbox-thread-table__main";
  const breadcrumb = document.createElement("p");
  breadcrumb.className = "mechbox-thread-table__breadcrumb";
  breadcrumb.append("规格库 / 紧固螺纹 / ");
  const crumbSystem = document.createElement("span");
  crumbSystem.className = "mechbox-thread-table__breadcrumb-system";
  breadcrumb.append(crumbSystem);

  const metaCard = document.createElement("section");
  metaCard.className = "mechbox-thread-table__meta-card";
  const metaTitle = document.createElement("h2");
  metaTitle.className = "mechbox-thread-table__meta-title";
  metaCard.append(metaTitle, makeMetaGrid(selectedSystem(root)));

  const tableSection = document.createElement("section");
  tableSection.className = "mechbox-thread-table__catalog-section";
  const tableHeader = document.createElement("div");
  tableHeader.className = "mechbox-thread-table__catalog-header";
  const seriesTitle = document.createElement("h2");
  seriesTitle.className = "mechbox-thread-table__series-title";
  const unit = document.createElement("span");
  unit.className = "mechbox-thread-table__unit";
  tableHeader.append(seriesTitle, unit);

  const filters = document.createElement("div");
  filters.className = "mechbox-thread-table__filters";
  const queryInput = textInput("query", "");
  queryInput.placeholder = translated("query_placeholder", "搜索 M10、M10×1.5、G1/2、1/4-20");
  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      void loadThreadCatalog(panel, { resetPage: true });
    }
  });
  const priorityWrap = document.createElement("label");
  priorityWrap.className = "mechbox-thread-table__priority-filter";
  priorityWrap.append("优先级 ", selectInput("priority", [["all", "全部"], ["1", "1"], ["2", "2"]], "all"));
  priorityWrap.querySelector("select").addEventListener("change", () => {
    void loadThreadCatalog(panel, { resetPage: true });
  });
  const searchButton = document.createElement("button");
  searchButton.type = "button";
  searchButton.className = "btn btn-primary mechbox-thread-table__search-btn";
  searchButton.textContent = translated("calculate", "Search");
  searchButton.addEventListener("click", () => void loadThreadCatalog(panel, { resetPage: true }));
  filters.append(queryInput, priorityWrap, searchButton);

  const error = document.createElement("div");
  error.className = "mechbox-thread-table__error";
  error.hidden = true;
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-thread-table__results-body";
  tableSection.append(tableHeader, filters, error, resultsBody);
  main.append(breadcrumb, metaCard, tableSection);
  shell.append(sidebar, main);
  root.append(shell);
  mount.append(root);

  updateCatalogCopy(root);
  catalog.querySelector("button")?.classList.add("is-active");
  await loadThreadCatalog(panel);
}
