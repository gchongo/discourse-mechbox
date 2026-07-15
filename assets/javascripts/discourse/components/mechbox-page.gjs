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

  get home() {
    return this.model.home || {};
  }

  get calculateEnabled() {
    return !!this.model.capabilities?.calculate?.enabled;
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
        <div class="mechbox__home">
          <header class="mechbox__home-hero">
            <div>
              <h1>{{i18n "mechbox.title"}}</h1>
              <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
            </div>
            {{#if this.home.counts}}
              <p class="mechbox__home-counts">
                {{i18n
                  "mechbox.home.counts"
                  available=this.home.counts.available
                  catalog=this.home.counts.catalog
                }}
              </p>
            {{/if}}
          </header>

          {{#if this.home.available_tools.length}}
            <section class="mechbox__home-section">
              <header class="mechbox__home-section-head">
                <h2>{{i18n "mechbox.home.available_title"}}</h2>
              </header>
              <div class="mechbox__home-card-grid">
                {{#each this.home.available_tools as |tool|}}
                  {{#if (and tool.available this.calculateEnabled)}}
                    <a
                      href={{this.toolHref tool.tool_id}}
                      class="mechbox__home-card mechbox__home-card--available raw-link"
                    >
                      <span class="mechbox__home-card-name">{{tool.name}}</span>
                      <span class="mechbox__home-card-desc">{{tool.description}}</span>
                      <span class="mechbox__home-card-badge">
                        {{i18n "mechbox.catalog.status.available"}}
                      </span>
                    </a>
                  {{else}}
                    <div class="mechbox__home-card mechbox__home-card--planned">
                      <span class="mechbox__home-card-name">{{tool.name}}</span>
                      <span class="mechbox__home-card-desc">{{tool.description}}</span>
                      <span class="mechbox__home-card-badge">
                        {{i18n "mechbox.catalog.status.planned"}}
                      </span>
                    </div>
                  {{/if}}
                {{/each}}
              </div>
            </section>
          {{/if}}

          <section class="mechbox__home-section">
            <header class="mechbox__home-section-head">
              <h2>{{i18n "mechbox.home.analysis_title"}}</h2>
            </header>
            <div class="mechbox__home-analysis-grid">
              {{#each this.home.analysis_groups as |group|}}
                <div class="mechbox__home-analysis-group">
                  <h3>{{group.name}}</h3>
                  <ul class="mechbox__home-analysis-list">
                    {{#each group.tools as |tool|}}
                      <li>
                        <span class="mechbox__home-analysis-name">{{tool.name}}</span>
                        <span class="mechbox__home-card-badge">
                          {{i18n "mechbox.home.coming_soon"}}
                        </span>
                      </li>
                    {{/each}}
                  </ul>
                </div>
              {{/each}}
            </div>
          </section>

          <section class="mechbox__home-section">
            <header class="mechbox__home-section-head">
              <h2>{{i18n "mechbox.home.stat_title"}}</h2>
            </header>
            <div class="mechbox__home-card-grid">
              {{#each this.home.stat_tools as |tool|}}
                {{#if (and tool.available tool.tool_id this.calculateEnabled)}}
                  <a
                    href={{this.toolHref tool.tool_id}}
                    class="mechbox__home-card mechbox__home-card--available raw-link"
                  >
                    <span class="mechbox__home-card-name">{{tool.name}}</span>
                    <span class="mechbox__home-card-desc">{{tool.description}}</span>
                  </a>
                {{else}}
                  <div class="mechbox__home-card mechbox__home-card--planned">
                    <span class="mechbox__home-card-name">{{tool.name}}</span>
                    <span class="mechbox__home-card-desc">{{tool.description}}</span>
                    <span class="mechbox__home-card-badge">
                      {{i18n "mechbox.home.coming_soon"}}
                    </span>
                  </div>
                {{/if}}
              {{/each}}
            </div>
          </section>

          <section class="mechbox__home-section">
            <header class="mechbox__home-section-head">
              <h2>{{i18n "mechbox.home.mech_title"}}</h2>
            </header>
            {{#each this.home.mech_groups as |group|}}
              <div class="mechbox__home-tool-block">
                <h3 class="mechbox__home-tool-block-label">{{group.name}}</h3>
                <div class="mechbox__home-card-grid">
                  {{#each group.tools as |tool|}}
                    {{#if (and tool.available tool.tool_id this.calculateEnabled)}}
                      <a
                        href={{this.toolHref tool.tool_id}}
                        class="mechbox__home-card mechbox__home-card--available raw-link"
                        data-tool-id={{tool.tool_id}}
                      >
                        <span class="mechbox__home-card-name">{{tool.name}}</span>
                        <span class="mechbox__home-card-desc">{{tool.description}}</span>
                        <span class="mechbox__home-card-badge">
                          {{i18n "mechbox.catalog.status.available"}}
                        </span>
                      </a>
                    {{else}}
                      <div class="mechbox__home-card mechbox__home-card--planned">
                        <span class="mechbox__home-card-name">{{tool.name}}</span>
                        <span class="mechbox__home-card-desc">{{tool.description}}</span>
                        <span class="mechbox__home-card-badge">
                          {{i18n "mechbox.home.coming_soon"}}
                        </span>
                      </div>
                    {{/if}}
                  {{/each}}
                </div>
              </div>
            {{/each}}
          </section>
        </div>
      {{/if}}
    </section>
  </template>
}
