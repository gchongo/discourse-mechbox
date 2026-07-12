import { i18n } from "discourse-i18n";
import { on } from "@ember/modifier";
import { and } from "discourse/truth-helpers";

export default <template>
  <section class="mechbox__page">
    {{#if @controller.selectedTool}}
      <header class="mechbox__header">
        <p>
          <a href="/mechbox" class="mechbox__back-link">
            {{i18n "mechbox.back_to_home"}}
          </a>
        </p>
        <h1>{{@controller.selectedTool.name}}</h1>
        <p class="mechbox__disclaimer">{{@controller.selectedTool.description}}</p>
      </header>

      {{#if @controller.selectedTool.available}}
        <div class="mechbox__workbench-panel">
          <h2>{{i18n "mechbox.workbench_title"}}</h2>

          {{#each @controller.selectedTool.inputs as |input|}}
            <label class="mechbox__input-label">{{input.key}}</label>
            <input
              type="text"
              class="mechbox__inputs"
              name={{input.key}}
              {{on "input" @controller.handleInput}}
            />
          {{/each}}

          <div class="mechbox__actions">
            <button
              type="button"
              class="btn btn-primary"
              disabled={{@controller.isCalculating}}
              {{on "click" @controller.calculate}}
            >
              {{#if @controller.isCalculating}}
                {{i18n "mechbox.calculating"}}
              {{else}}
                {{i18n "mechbox.calculate"}}
              {{/if}}
            </button>
          </div>

          {{#if @controller.errorMessage}}
            <p class="mechbox__error">{{@controller.errorMessage}}</p>
          {{/if}}

          {{#if @controller.result}}
            <h3>{{i18n "mechbox.result_title"}}</h3>
            <pre class="mechbox__result">{{@controller.resultJson}}</pre>
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

          {{#if @controller.model.builtin_tools.length}}
            <ul class="mechbox__tool-list">
              {{#each @controller.model.builtin_tools as |tool|}}
                <li>
                  <div>
                    {{#if (and tool.available @controller.model.capabilities.calculate.enabled)}}
                      <a
                        href="/mechbox?tool_id={{tool.tool_id}}"
                        class="mechbox__tool-link"
                      >
                        <div class="mechbox__tool-name">{{tool.name}}</div>
                      </a>
                    {{else}}
                      <div class="mechbox__tool-name">{{tool.name}}</div>
                    {{/if}}
                    <div class="mechbox__tool-description">
                      {{tool.description}}
                    </div>
                  </div>
                  <span class="mechbox__tool-badge">
                    {{#if (and tool.available @controller.model.capabilities.calculate.enabled)}}
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
            {{#each @controller.model.design_chains as |chain|}}
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
