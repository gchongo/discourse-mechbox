import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import { mountBoltWorkbench } from "../lib/mechbox-bolt-page";
import { mountUnitsWorkbench } from "../lib/mechbox-units-page";
import { mountRssWorkbench } from "../lib/mechbox-rss-page";
import { mountGdtWorkbench } from "../lib/mechbox-gdt-page";

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
    "mechbox__workbench-panel--gdt"
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

function mountWorkbenchForm(panel) {
  if (!panel || panel.dataset.mounted === "true") {
    return;
  }

  const toolId = panel.dataset.toolId;

  if (toolId === "bolt_clamp_load") {
    mountBoltWorkbench(panel);
  } else if (toolId === "unit_converter") {
    mountUnitsWorkbench(panel);
  } else if (toolId === "rss_calculation") {
    mountRssWorkbench(panel);
  } else if (toolId === "gdt_position") {
    mountGdtWorkbench(panel);
  } else {
    mountGenericWorkbench(panel);
  }
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
  "bolt_clamp_load",
  "unit_converter",
  "rss_calculation",
  "gdt_position",
]);

async function calculateGeneric(event) {
  const button = event.target.closest(".mechbox__calculate-btn");

  if (!button || button.disabled) {
    return;
  }

  if (
    button.classList.contains("mechbox-bolt__calculate-btn") ||
    button.classList.contains("mechbox-units__calculate-btn") ||
    button.classList.contains("mechbox-rss__calculate-btn") ||
    button.classList.contains("mechbox-gdt__calculate-btn")
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
