import { i18n } from "discourse-i18n";
import { concat } from "@ember/helper";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__workbench-panel">
      <h2>{{i18n "mechbox.catalog.analysis_type_title"}}</h2>
      <div class="mechbox__analysis-grid">
        {{#each @controller.analysisCategories as |category|}}
          <section class="mechbox__analysis-card">
            <h3>{{i18n (concat "mechbox.catalog.analysis_categories." category.id)}}</h3>
            <ul class="mechbox__analysis-tool-list">
              {{#each category.tools as |toolId|}}
                <li>
                  <span>{{i18n (concat "mechbox.catalog.analysis_tools." toolId)}}</span>
                  <span aria-hidden="true">›</span>
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
        {{#each @controller.singleToolDirectory as |tool|}}
          <article class="mechbox__catalog-card">
            <h3>{{i18n (concat "mechbox.catalog.tools." tool.id ".name")}}</h3>
            <p>{{i18n (concat "mechbox.catalog.tools." tool.id ".description")}}</p>
            <div class="mechbox__catalog-status">
              {{i18n (concat "mechbox.catalog.status." tool.status)}}
            </div>
          </article>
        {{/each}}
      </div>

      <p>
        <strong>{{i18n "mechbox.api_prefix_label"}}:</strong>
        <code>{{@controller.apiPrefix}}</code>
      </p>
      <h3>{{i18n "mechbox.future_interfaces_title"}}</h3>
      <ul class="mechbox__record-list">
        {{#each @controller.futureInterfaces as |feature|}}
          <li><code>{{feature}}</code></li>
        {{/each}}
      </ul>
    </div>
  </section>
</template>
