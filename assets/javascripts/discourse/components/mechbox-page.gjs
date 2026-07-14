import Component from "@glimmer/component";
import getURL from "discourse/lib/get-url";
import { i18n } from "discourse-i18n";
import { and } from "discourse/truth-helpers";

export default class MechboxPage extends Component {
  get model() {
    return this.args.model || {};
  }

  get selectedTool() {
    return this.model.selected_tool;
  }

  get catalogHref() {
    return getURL("/mechbox");
  }

  get inputsJson() {
    return JSON.stringify(this.selectedTool?.inputs || []);
  }

  toolHref(toolId) {
    return getURL(`/mechbox?tool_id=${toolId}`);
  }

  <template>
    <section class="mechbox__page">
      {{#if this.selectedTool}}
        <header class="mechbox__header">
          <p>
            <a href={{this.catalogHref}} class="mechbox__back-link raw-link">
              {{i18n "mechbox.back_to_home"}}
            </a>
          </p>
          <h1>{{this.selectedTool.name}}</h1>
          <p class="mechbox__disclaimer">{{this.selectedTool.description}}</p>
        </header>

        {{#if this.selectedTool.available}}
          <div
            class="mechbox__workbench-panel"
            data-tool-id={{this.selectedTool.tool_id}}
            data-inputs-json={{this.inputsJson}}
          >
            <h2>{{i18n "mechbox.workbench_title"}}</h2>

            {{! Form fields are mounted by mechbox-workbench initializer (vanilla DOM). }}
            <div class="mechbox__form-mount"></div>

            <div class="mechbox__actions">
              <button type="button" class="btn btn-primary mechbox__calculate-btn">
                {{i18n "mechbox.calculate"}}
              </button>
            </div>

            <p class="mechbox__error" hidden></p>

            <h3 class="mechbox__result-title" hidden>
              {{i18n "mechbox.result_title"}}
            </h3>
            <pre class="mechbox__result" hidden></pre>
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
                        <a
                          href={{this.toolHref tool.tool_id}}
                          class="mechbox__tool-link raw-link"
                        >
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
