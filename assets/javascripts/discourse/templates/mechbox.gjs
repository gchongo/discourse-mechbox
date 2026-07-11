import { i18n } from "discourse-i18n";
import { LinkTo } from "@ember/routing";
import { and } from "discourse/truth-helpers";

export default <template>
  <section class="mechbox__page">
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
                    <LinkTo @route="mechbox-tool" @model={{tool.tool_id}}>
                      <div class="mechbox__tool-name">{{tool.name}}</div>
                    </LinkTo>
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
  </section>
</template>
