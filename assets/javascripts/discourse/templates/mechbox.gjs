import { i18n } from "discourse-i18n";
import { concat } from "@ember/helper";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__workbench-panel">
      <h2>{{i18n "mechbox.catalog.single_tool_directory_title"}}</h2>
      <p>{{i18n "mechbox.catalog.single_tool_directory_hint"}}</p>
      <p class="mechbox__catalog-note">
        {{i18n "mechbox.catalog.multi_chain_archive_note"}}
      </p>

      <div class="mechbox__catalog-grid">
        {{#each this.singleToolDirectory as |tool|}}
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
        <code>{{this.apiPrefix}}</code>
      </p>
      <h3>{{i18n "mechbox.future_interfaces_title"}}</h3>
      <ul class="mechbox__record-list">
        {{#each this.futureInterfaces as |feature|}}
          <li><code>{{feature}}</code></li>
        {{/each}}
      </ul>
    </div>
  </section>
</template>
