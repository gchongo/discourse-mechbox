import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import getURL from "discourse/lib/get-url";
import { i18n } from "discourse-i18n";
import { and } from "discourse/truth-helpers";

export default class MechboxPage extends Component {
  inputValues = {};

  @tracked selectedTool = null;
  @tracked result = null;
  @tracked isCalculating = false;
  @tracked errorMessage = null;
  @tracked isLoadingTool = false;

  constructor() {
    super(...arguments);
    this.selectedTool = this.args.model?.selected_tool || null;
  }

  get model() {
    return this.args.model || {};
  }

  get resultJson() {
    if (!this.result) {
      return "";
    }

    return JSON.stringify(this.result, null, 2);
  }

  resetWorkbench() {
    this.inputValues = {};
    this.result = null;
    this.isCalculating = false;
    this.errorMessage = null;
  }

  @action
  async openTool(tool) {
    this.isLoadingTool = true;
    this.errorMessage = null;

    try {
      this.selectedTool = await ajax(`/mechbox/api/tools/${tool.tool_id}`);
      this.resetWorkbench();
      window.history.pushState(null, "", getURL(`/mechbox?tool_id=${tool.tool_id}`));
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.isLoadingTool = false;
    }
  }

  @action
  backToCatalog() {
    this.selectedTool = null;
    this.resetWorkbench();
    window.history.pushState(null, "", getURL("/mechbox"));
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

  <template>
    <section class="mechbox__page">
      {{#if this.selectedTool}}
        <header class="mechbox__header">
          <p>
            <button
              type="button"
              class="btn-flat mechbox__back-link"
              {{on "click" this.backToCatalog}}
            >
              {{i18n "mechbox.back_to_home"}}
            </button>
          </p>
          <h1>{{this.selectedTool.name}}</h1>
          <p class="mechbox__disclaimer">{{this.selectedTool.description}}</p>
        </header>

        {{#if this.selectedTool.available}}
          <div class="mechbox__workbench-panel">
            <h2>{{i18n "mechbox.workbench_title"}}</h2>

            {{#each this.selectedTool.inputs as |input|}}
              <label class="mechbox__input-label">{{input.key}}</label>
              <input
                type="text"
                class="mechbox__inputs"
                name={{input.key}}
                {{on "input" this.handleInput}}
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
      {{else}}
        <header class="mechbox__header">
          <h1>{{i18n "mechbox.title"}}</h1>
          <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
        </header>

        <div class="mechbox__catalog-grid">
          <section class="mechbox__catalog-card">
            <h2>{{i18n "mechbox.builtin_tools_title"}}</h2>
            <p>{{i18n "mechbox.catalog.single_tool_directory_hint"}}</p>

            {{#if this.model.builtin_tools.length}}
              <ul class="mechbox__tool-list">
                {{#each this.model.builtin_tools as |tool|}}
                  <li>
                    <div>
                      {{#if (and tool.available this.model.capabilities.calculate.enabled)}}
                        <button
                          type="button"
                          class="btn-flat mechbox__tool-link"
                          disabled={{this.isLoadingTool}}
                          {{on "click" (fn this.openTool tool)}}
                        >
                          <span class="mechbox__tool-name">{{tool.name}}</span>
                        </button>
                      {{else}}
                        <div class="mechbox__tool-name">{{tool.name}}</div>
                      {{/if}}
                      <div class="mechbox__tool-description">
                        {{tool.description}}
                      </div>
                    </div>
                    <span class="mechbox__tool-badge">
                      {{#if (and tool.available this.model.capabilities.calculate.enabled)}}
                        {{i18n "mechbox.catalog.status.available"}}
                      {{else}}
                        {{i18n "mechbox.catalog.status.planned"}}
                      {{/if}}
                    </span>
                  </li>
                {{/each}}
              </ul>
            {{else}}
              <p>{{i18n "mechbox.no_builtin_tools"}}</p>
            {{/if}}
          </section>

          <section class="mechbox__catalog-card mechbox__catalog-card--deferred">
            <h2>{{i18n "mechbox.catalog.analysis_type_title"}}</h2>
            <p>{{i18n "mechbox.catalog.multi_chain_archive_note"}}</p>

            <ul class="mechbox__tool-list">
              {{#each this.model.design_chains as |chain|}}
                <li>
                  <div>
                    <div class="mechbox__tool-name">{{chain.name}}</div>
                    <div class="mechbox__tool-description">
                      {{chain.description}}
                    </div>
                  </div>
                  <span class="mechbox__tool-badge">
                    {{i18n "mechbox.catalog.status.deferred"}}
                  </span>
                </li>
              {{/each}}
            </ul>
          </section>
        </div>
      {{/if}}
    </section>
  </template>
}
