import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import { mountBoltWorkbench } from "../lib/mechbox-bolt-page";
import { mountUnitsWorkbench } from "../lib/mechbox-units-page";
import { mountRssWorkbench } from "../lib/mechbox-rss-page";
import { mountGdtWorkbench } from "../lib/mechbox-gdt-page";
import { mountThreadWorkbench } from "../lib/mechbox-thread-page";
import { mountKeyWorkbench } from "../lib/mechbox-key-page";
import { mountBoltGroupWorkbench } from "../lib/mechbox-bolt-group-page";
import { mountWeldWorkbench } from "../lib/mechbox-weld-page";
import { mountSpringWorkbench } from "../lib/mechbox-spring-page";
import { mountClutchWorkbench } from "../lib/mechbox-clutch-page";
import { mountBeltWorkbench } from "../lib/mechbox-belt-page";
import { mountChainWorkbench } from "../lib/mechbox-chain-page";
import { mountTolConvertWorkbench } from "../lib/mechbox-tol-convert-page";
import { mountSigmaAnalysisWorkbench } from "../lib/mechbox-sigma-page";
import { mountFitWorkbench } from "../lib/mechbox-fit-page";
import { mountDistributionChartWorkbench } from "../lib/mechbox-distribution-page";
import { mountThermalExpansionWorkbench } from "../lib/mechbox-thermal-page";
import { mountInterferenceFitWorkbench } from "../lib/mechbox-interference-page";
import { mountBearingWorkbench } from "../lib/mechbox-bearing-page";
import { mountShaftWorkbench } from "../lib/mechbox-shaft-page";
import { mountGearRatioWorkbench } from "../lib/mechbox-gear-ratio-page";
import { mountGearWorkbench } from "../lib/mechbox-gear-page";
import { mountFatigueWorkbench } from "../lib/mechbox-fatigue-page";
import { mountBeamWorkbench } from "../lib/mechbox-beam-page";
import { mountSheetMetalWorkbench } from "../lib/mechbox-sheet-metal-page";
import { mountCylinderWorkbench } from "../lib/mechbox-cylinder-page";
import { mountORingWorkbench } from "../lib/mechbox-o-ring-page";
import { mountStructuralWorkbench } from "../lib/mechbox-structural-page";
import { mountManufacturingWorkbench } from "../lib/mechbox-manufacturing-page";
import { mountHeatTreatmentWorkbench } from "../lib/mechbox-heat-treatment-page";
import { mountMaterialsWorkbench } from "../lib/mechbox-materials-page";
import { mountMaterialSelectionWorkbench } from "../lib/mechbox-material-selection-page";
import { mountThreadTableWorkbench } from "../lib/mechbox-thread-table-page";
let handlersRegistered = false;

function parseInputsSchema(panel) {
  const raw = panel.getAttribute("data-inputs-json");

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mountGenericWorkbench(panel) {
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
    "mechbox__workbench-panel--cylinder",
    "mechbox__workbench-panel--o-ring",
    "mechbox__workbench-panel--structural",
    "mechbox__workbench-panel--manufacturing",
    "mechbox__workbench-panel--heat-treatment",
    "mechbox__workbench-panel--materials",
    "mechbox__workbench-panel--material-selection",
    "mechbox__workbench-panel--thread-table"
  );
  mount.replaceChildren();

  for (const field of parseInputsSchema(panel)) {
    const key = field?.key;

    if (!key) {
      continue;
    }

    const label = document.createElement("label");
    label.className = "mechbox__input-label";
    label.htmlFor = `mechbox-input-${key}`;
    label.textContent = key;

    const input = document.createElement("input");
    input.id = `mechbox-input-${key}`;
    input.type = "text";
    input.className = "mechbox__inputs";
    input.name = key;
    input.dataset.type = field.type || "string";
    input.autocomplete = "off";

    mount.append(label, input);
  }

  panel.dataset.mounted = "true";
}

function resetWorkbenchIfToolChanged(panel) {
  const toolId = panel.dataset.toolId || "";
  if (panel.dataset.mounted !== "true") {
    return;
  }

  const mountedToolId = panel.dataset.mountedToolId;
  if (mountedToolId && mountedToolId === toolId) {
    return;
  }
  if (!mountedToolId) {
    return;
  }

  panel.dataset.mounted = "false";
  delete panel.dataset.mountedToolId;
  panel.querySelector(".mechbox__form-mount")?.replaceChildren();
}

function mountWorkbenchForm(panel) {
  if (!panel) {
    return;
  }

  resetWorkbenchIfToolChanged(panel);

  if (panel.dataset.mounted === "true" || panel.dataset.mounted === "mounting") {
    return;
  }

  const toolId = panel.dataset.toolId;
  // Custom workbenches mount asynchronously. Mark them before their DOM writes
  // trigger the global MutationObserver, otherwise every mutation can start a
  // duplicate mount (and duplicate initial calculate request).
  panel.dataset.mounted = "mounting";

  if (toolId === "gear_ratio") {
    void mountGearRatioWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "bolt_clamp_load") {
    void mountBoltWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "unit_converter") {
    void mountUnitsWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "rss_calculation") {
    void mountRssWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "gdt_position") {
    void mountGdtWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "thread") {
    void mountThreadWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "key") {
    void mountKeyWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "bolt_group") {
    void mountBoltGroupWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "weld") {
    void mountWeldWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "spring") {
    void mountSpringWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "clutch") {
    void mountClutchWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "belt") {
    void mountBeltWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "chain") {
    void mountChainWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "tol_convert") {
    void mountTolConvertWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "sigma_analysis") {
    void mountSigmaAnalysisWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "fit") {
    void mountFitWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "distribution_chart") {
    void mountDistributionChartWorkbench(panel).then(() =>
      markWorkbenchMounted(panel, toolId)
    );
  } else if (toolId === "thermal_expansion") {
    void mountThermalExpansionWorkbench(panel).then(() =>
      markWorkbenchMounted(panel, toolId)
    );
  } else if (toolId === "interference_fit") {
    void mountInterferenceFitWorkbench(panel).then(() =>
      markWorkbenchMounted(panel, toolId)
    );
  } else if (toolId === "bearing") {
    void mountBearingWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "shaft") {
    void mountShaftWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "gear") {
    void mountGearWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "fatigue") {
    void mountFatigueWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "beam") {
    void mountBeamWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "sheet_metal") {
    void mountSheetMetalWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "cylinder") {
    void mountCylinderWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "o_ring") {
    void mountORingWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "structural") {
    void mountStructuralWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "manufacturing") {
    void mountManufacturingWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "heat_treatment") {
    void mountHeatTreatmentWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "materials") {
    void mountMaterialsWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else if (toolId === "material_selection") {
    void mountMaterialSelectionWorkbench(panel).then(() =>
      markWorkbenchMounted(panel, toolId)
    );
  } else if (toolId === "thread_table") {
    void mountThreadTableWorkbench(panel).then(() => markWorkbenchMounted(panel, toolId));
  } else {
    mountGenericWorkbench(panel);
    markWorkbenchMounted(panel, toolId);
  }
}

function markWorkbenchMounted(panel, toolId) {
  if (!panel || panel.dataset.toolId !== toolId) {
    return;
  }
  panel.dataset.mounted = "true";
  panel.dataset.mountedToolId = toolId;
}

function mountAllWorkbenchForms() {
  document
    .querySelectorAll(".mechbox__workbench-panel:not([data-mounted='true'])")
    .forEach(mountWorkbenchForm);
}

function parsedInputs(panel) {
  const inputs = {};

  for (const input of panel.querySelectorAll(".mechbox__inputs[name]")) {
    const key = input.getAttribute("name");
    const type = input.dataset.type;
    const raw = input.value;

    if (type === "number" || type === "integer") {
      inputs[key] = raw === "" ? null : Number(raw);
    } else {
      inputs[key] = raw;
    }
  }

  return inputs;
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox__error");

  if (!error) {
    return;
  }

  if (message) {
    error.textContent = message;
    error.hidden = false;
  } else {
    error.textContent = "";
    error.hidden = true;
  }
}

function setResult(panel, result) {
  const resultEl = panel.querySelector(".mechbox__result");
  const titleEl = panel.querySelector(".mechbox__result-title");

  if (!resultEl) {
    return;
  }

  if (result) {
    resultEl.textContent = JSON.stringify(result, null, 2);
    resultEl.hidden = false;
    if (titleEl) {
      titleEl.hidden = false;
    }
  } else {
    resultEl.textContent = "";
    resultEl.hidden = true;
    if (titleEl) {
      titleEl.hidden = true;
    }
  }
}

const CUSTOM_TOOL_IDS = new Set([
  "gear_ratio",
  "bolt_clamp_load",
  "unit_converter",
  "rss_calculation",
  "gdt_position",
  "thread",
  "key",
  "bolt_group",
  "weld",
  "spring",
  "clutch",
  "belt",
  "chain",
  "tol_convert",
  "sigma_analysis",
  "fit",
  "distribution_chart",
  "thermal_expansion",
  "interference_fit",
  "bearing",
  "shaft",
  "gear",
  "fatigue",
  "beam",
  "sheet_metal",
  "cylinder",
  "o_ring",
  "structural",
  "manufacturing",
  "heat_treatment",
  "materials",
  "material_selection",
  "thread_table",
]);

async function calculateGeneric(event) {
  const button = event.target.closest(".mechbox__calculate-btn");

  if (!button || button.disabled) {
    return;
  }

  if (
    button.classList.contains("mechbox-gear-ratio__calculate-btn") ||
    button.classList.contains("mechbox-bolt__calculate-btn") ||
    button.classList.contains("mechbox-units__calculate-btn") ||
    button.classList.contains("mechbox-rss__calculate-btn") ||
    button.classList.contains("mechbox-gdt__calculate-btn") ||
    button.classList.contains("mechbox-thread__calculate-btn") ||
    button.classList.contains("mechbox-key__calculate-btn") ||
    button.classList.contains("mechbox-bolt-group__calculate-btn") ||
    button.classList.contains("mechbox-weld__calculate-btn") ||
    button.classList.contains("mechbox-spring__calculate-btn") ||
    button.classList.contains("mechbox-clutch__calculate-btn") ||
    button.classList.contains("mechbox-belt__calculate-btn") ||
    button.classList.contains("mechbox-chain__calculate-btn") ||
    button.classList.contains("mechbox-tol-convert__calculate-btn") ||
    button.classList.contains("mechbox-sigma__calculate-btn") ||
    button.classList.contains("mechbox-fit__calculate-btn") ||
    button.classList.contains("mechbox-distribution__calculate-btn") ||
    button.classList.contains("mechbox-thermal__calculate-btn") ||
    button.classList.contains("mechbox-interference__calculate-btn") ||
    button.classList.contains("mechbox-bearing__calculate-btn") ||
    button.classList.contains("mechbox-shaft__calculate-btn") ||
    button.classList.contains("mechbox-gear__calculate-btn") ||
    button.classList.contains("mechbox-fatigue__calculate-btn") ||
    button.classList.contains("mechbox-beam__calculate-btn") ||
    button.classList.contains("mechbox-sheet-metal__calculate-btn") ||
    button.classList.contains("mechbox-cylinder__calculate-btn") ||
    button.classList.contains("mechbox-o-ring__calculate-btn") ||
    button.classList.contains("mechbox-structural__calculate-btn") ||
    button.classList.contains("mechbox-manufacturing__calculate-btn") ||
    button.classList.contains("mechbox-heat-treatment__calculate-btn") ||
    button.classList.contains("mechbox-materials__calculate-btn") ||
    button.classList.contains("mechbox-material-selection__calculate-btn") ||
    button.classList.contains("mechbox-thread-table__calculate-btn")
  ) {
    return;
  }

  const panel = button.closest(".mechbox__workbench-panel");

  if (!panel || CUSTOM_TOOL_IDS.has(panel.dataset.toolId)) {
    return;
  }

  const toolId = panel.dataset.toolId;

  if (!toolId) {
    return;
  }

  event.preventDefault();
  mountWorkbenchForm(panel);

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setError(panel, null);
  setResult(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: toolId,
        save_record: false,
        inputs: parsedInputs(panel),
      },
    });

    setResult(panel, result);
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

function registerHandlers(api) {
  if (handlersRegistered || typeof document === "undefined") {
    return;
  }

  document.addEventListener("click", calculateGeneric);

  const observer = new MutationObserver(() => {
    mountAllWorkbenchForms();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  api.onPageChange(() => mountAllWorkbenchForms());
  mountAllWorkbenchForms();

  handlersRegistered = true;
}

export default {
  name: "discourse-mechbox-workbench",

  initialize() {
    withPluginApi((api) => {
      registerHandlers(api);
    });
  },
};
