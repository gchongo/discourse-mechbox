import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import getURL from "discourse/lib/get-url";
import { i18n } from "discourse-i18n";
import { and } from "discourse/truth-helpers";
import DButton from "discourse/ui-kit/d-button";

export default class MechboxPage extends Component {
  @tracked result = null;
  @tracked isCalculating = false;
  @tracked errorMessage = null;

  get model() {
    return this.args.model || {};
  }

  get selectedTool() {
    return this.model.selected_tool;
  }

  get resultJson() {
    if (!this.result) {
      return "";
    }

    return JSON.stringify(this.result, null, 2);
  }

  toolHref(toolId) {
    return getURL(`/mechbox?tool_id=${toolId}`);
  }

  catalogHref() {
    return getURL("/mechbox");
  }

  get calculateLabel() {
    return this.isCalculating
      ? i18n("mechbox.calculating")
      : i18n("mechbox.calculate");
  }

  @action
  async calculate() {
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
    const panel = document.querySelector(".mechbox__workbench-panel");

    for (const input of this.selectedTool?.inputs || []) {
      const raw = panel?.querySelector(`[name="${input.key}"]`)?.value;

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
            <a href={{this.catalogHref}} class="mechbox__back-link">
              {{i18n "mechbox.back_to_home"}}
            </a>
          </p>
          <h1>{{this.selectedTool.name}}</h1>
          <p class="mechbox__disclaimer">{{this.selectedTool.description}}</p>
        </header>

        {{#if this.selectedTool.available}}
          <div class="mechbox__workbench-panel">
            <h2>{{i18n "mechbox.workbench_title"}}</h2>

            {{#each this.selectedTool.inputs as |input|}}
              <label class="mechbox__input-label" for="mechbox-input-{{input.key}}">
                {{input.key}}
              </label>
              <input
                id="mechbox-input-{{input.key}}"
                type="text"
                class="mechbox__inputs"
                name={{input.key}}
                autocomplete="off"
              />
            {{/each}}

            <div class="mechbox__actions">
              <DButton
                @label={{this.calculateLabel}}
                @action={{this.calculate}}
                @disabled={{this.isCalculating}}
                class="btn-primary"
              />
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
                        <a href={{this.toolHref tool.tool_id}} class="mechbox__tool-link">
                          <span class="mechbox__tool-name">{{tool.name}}</span>
                        </a>
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
