import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class MechboxController extends Controller {
  inputValues = {};

  @tracked result = null;
  @tracked isCalculating = false;
  @tracked errorMessage = null;

  get selectedTool() {
    return this.model?.selected_tool;
  }

  get resultJson() {
    if (!this.result) {
      return "";
    }

    return JSON.stringify(this.result, null, 2);
  }

  @action
  handleInput(event) {
    this.inputValues[event.target.name] = event.target.value;
  }

  @action
  async calculate(event) {
    event?.preventDefault?.();

    if (!this.selectedTool?.available) {
      return;
    }

    this.isCalculating = true;
    this.errorMessage = null;
    this.result = null;

    try {
      this.result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: this.selectedTool.tool_id,
          save_record: false,
          inputs: this.parsedInputs(),
        },
      });
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

    for (const input of this.selectedTool.inputs || []) {
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
