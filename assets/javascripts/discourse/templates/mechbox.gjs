import { i18n } from "discourse-i18n";
import { LinkTo } from "@ember/routing";
import { concat } from "@ember/helper";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__workbench-panel">
      <h2>{{i18n "mechbox.builtin_tools_title"}}</h2>
      {{#if @controller.availableBuiltinTools.length}}
        <ul class="mechbox__tool-list">
          {{#each @controller.availableBuiltinTools as |tool|}}
            <li>
              <LinkTo
                @route="mechbox-tool"
                @model={{tool.tool_id}}
                class="btn btn-flat mechbox__tool-btn"
              >
                <span>{{tool.name}}</span>
              </LinkTo>
            </li>
          {{/each}}
        </ul>
      {{else}}
        <p>{{i18n "mechbox.no_builtin_tools"}}</p>
      {{/if}}

      <h2>{{i18n "mechbox.catalog.analysis_type_title"}}</h2>
      <div class="mechbox__analysis-grid">
        {{#each @controller.analysisCategories as |category|}}
          <section class="mechbox__analysis-card">
            <h3>{{i18n (concat "mechbox.catalog.analysis_categories." category.id)}}</h3>
            <ul class="mechbox__analysis-tool-list">
              {{#each category.tools as |toolId|}}
                <li>
                  <span>{{i18n (concat "mechbox.catalog.analysis_tools." toolId)}}</span>
                  <span class="mechbox__catalog-status">{{i18n "mechbox.catalog.status.planned"}}</span>
                </li>
              {{/each}}
            </ul>
          </section>
        {{/each}}
      </div>

      <h2>{{i18n "mechbox.catalog.single_tool_directory_title"}}</h2>
      <p>{{i18n "mechbox.catalog.single_tool_directory_hint"}}</p>
      <p class="mechbox__catalog-note">
        {{i18n "mechbox.catalog.multi_chain_archive_note"}}
      </p>

      <div class="mechbox__catalog-grid">
        {{#each @controller.designChains as |chain|}}
          <article class="mechbox__catalog-card mechbox__catalog-card--deferred">
            <h3>{{chain.name}}</h3>
            <p>{{chain.description}}</p>
            <div class="mechbox__catalog-status">
              {{i18n (concat "mechbox.catalog.status." chain.status)}}
            </div>
          </article>
        {{/each}}
      </div>
    </div>
  </section>
</template>
