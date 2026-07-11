import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

export default class MechboxToolPage extends Component {
  inputValues = {};

  @tracked result = null;
  @tracked isCalculating = false;
  @tracked errorMessage = null;

  get model() {
    return this.args.model || {};
  }

  get resultJson() {
    if (!this.result) {
      return "";
    }

    return JSON.stringify(this.result, null, 2);
  }

  @action
  updateInput(key, event) {
    this.inputValues[key] = event.target.value;
  }

  @action
  async calculate(event) {
    event?.preventDefault?.();

    if (!this.model.available) {
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

  <template>
    <section class="mechbox__page">
      <header class="mechbox__header">
        <p>
          <a href="/mechbox" data-auto-route="true" class="mechbox__back-link">
            {{i18n "mechbox.back_to_home"}}
          </a>
        </p>
        <h1>{{this.model.name}}</h1>
        <p class="mechbox__disclaimer">{{this.model.description}}</p>
      </header>

      {{#if this.model.available}}
        <div class="mechbox__workbench-panel">
          <h2>{{i18n "mechbox.workbench_title"}}</h2>

          {{#each this.model.inputs as |input|}}
            <label class="mechbox__input-label">{{input.key}}</label>
            <input
              type="text"
              class="mechbox__inputs"
              name={{input.key}}
              {{on "input" (fn this.updateInput input.key)}}
            />
          {{/each}}

          <div class="mechbox__actions">
            <button
              type="button"
              class="btn btn-primary"
              disabled={{this.isCalculating}}
              {{on "click" this.calculate}}
            >
              {{#if this.isCalculating}}
                {{i18n "mechbox.calculating"}}
              {{else}}
                {{i18n "mechbox.calculate"}}
              {{/if}}
            </button>
          </div>

          {{#if this.errorMessage}}
            <p class="mechbox__error">{{this.errorMessage}}</p>
          {{/if}}

          {{#if this.result}}
            <h3>{{i18n "mechbox.result_title"}}</h3>
            <pre class="mechbox__result">{{this.resultJson}}</pre>
          {{/if}}
        </div>
      {{else}}
        <p>{{i18n "mechbox.tool_not_available"}}</p>
      {{/if}}
    </section>
  </template>
}
