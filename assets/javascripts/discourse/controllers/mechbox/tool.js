import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default class MechboxToolController extends Controller {
  @tracked inputValues = {};
  @tracked calculationResult = null;
  @tracked errorMessage = null;
  @tracked isCalculating = false;

  resetFromTool(tool) {
    const values = {};

    (tool.inputs || []).forEach((input) => {
      values[input.key] = "";
    });

    this.inputValues = values;
    this.calculationResult = null;
    this.errorMessage = null;
    this.isCalculating = false;
  }

  get resultJson() {
    if (!this.calculationResult) {
      return "";
    }

    return JSON.stringify(this.calculationResult, null, 2);
  }

  buildInputsPayload() {
    const payload = {};

    (this.model.inputs || []).forEach((input) => {
      const rawValue = this.inputValues[input.key];

      if (input.type === "number" || input.type === "integer") {
        payload[input.key] = Number(rawValue);
      } else if (input.type === "number_array") {
        payload[input.key] = String(rawValue)
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => !Number.isNaN(value));
      } else {
        payload[input.key] = rawValue;
      }
    });

    return payload;
  }

  @action
  updateInput(key, event) {
    this.inputValues = { ...this.inputValues, [key]: event.target.value };
  }

  @action
  async calculate() {
    if (!this.model?.available) {
      return;
    }

    this.isCalculating = true;
    this.errorMessage = null;

    try {
      this.calculationResult = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: this.model.tool_id,
          inputs: this.buildInputsPayload(),
          save_record: false,
        },
      });
    } catch (error) {
      this.errorMessage = error?.jqXHR?.responseJSON?.errors?.[0] || error?.message;
    } finally {
      this.isCalculating = false;
    }
  }
}
