import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class MechboxToolController extends Controller {
  @tracked inputValues = {};
  @tracked result = null;
  @tracked isCalculating = false;
  @tracked errorMessage = null;

  inputValueFor = (key) => {
    return this.inputValues[key] ?? "";
  };

  get resultJson() {
    if (!this.result) {
      return "";
    }

    return JSON.stringify(this.result, null, 2);
  }

  @action
  updateInput(key, event) {
    this.inputValues = {
      ...this.inputValues,
      [key]: event.target.value,
    };
  }

  @action
  async calculate(event) {
    event?.preventDefault?.();

    if (!this.model?.available) {
      return;
    }

    this.isCalculating = true;
    this.errorMessage = null;
    this.result = null;

    try {
      const response = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: this.model.tool_id,
          save_record: false,
          inputs: this.parsedInputs(),
        },
      });

      this.result = response;
    } catch (error) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        this.errorMessage = error.jqXHR.responseJSON.errors.join(" ");
      } else {
        popupAjaxError(error);
      }
    } finally {
      this.isCalculating = false;
    }
  }

  parsedInputs() {
    const inputs = {};

    for (const input of this.model.inputs || []) {
      const raw = this.inputValues[input.key];

      if (input.type === "number" || input.type === "integer") {
        inputs[input.key] = raw === "" || raw === undefined ? null : Number(raw);
      } else {
        inputs[input.key] = raw;
      }
    }

    return inputs;
  }
}
