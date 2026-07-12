import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

let clickHandlerRegistered = false;

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

async function calculate(event) {
  const button = event.target.closest(".mechbox__calculate-btn");

  if (!button || button.disabled) {
    return;
  }

  const panel = button.closest(".mechbox__workbench-panel");

  if (!panel) {
    return;
  }

  const toolId = panel.dataset.toolId;

  if (!toolId) {
    return;
  }

  event.preventDefault();

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

function registerCalculateHandler() {
  if (clickHandlerRegistered || typeof document === "undefined") {
    return;
  }

  document.addEventListener("click", calculate);
  clickHandlerRegistered = true;
}

export default {
  name: "discourse-mechbox-workbench",

  initialize() {
    withPluginApi(() => {
      registerCalculateHandler();
    });
  },
};
