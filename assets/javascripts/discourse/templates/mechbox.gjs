import { i18n } from "discourse-i18n";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__grid">
      <aside class="mechbox__tools-panel">
        <h2>{{i18n "mechbox.builtin_tools_title"}}</h2>
        {{#if @model.builtin_tools.length}}
          <ul class="mechbox__tool-list">
            {{#each @model.builtin_tools as |tool|}}
              <li>
                <div>
                  <div class="mechbox__tool-name">{{tool.name}}</div>
                  {{#if tool.description}}
                    <div class="mechbox__tool-description">{{tool.description}}</div>
                  {{/if}}
                </div>
              </li>
            {{/each}}
          </ul>
        {{else}}
          <p>{{i18n "mechbox.no_builtin_tools"}}</p>
        {{/if}}
      </aside>

      <div class="mechbox__workbench-panel">
        <h2>{{i18n "mechbox.catalog.single_tool_directory_title"}}</h2>
        <p>{{i18n "mechbox.catalog.single_tool_directory_hint"}}</p>
        <p class="mechbox__phase-note">{{i18n "mechbox.skeleton_message"}}</p>
      </div>

      <aside class="mechbox__records-panel">
        <h2>{{i18n "mechbox.catalog.analysis_type_title"}}</h2>
        <p>{{i18n "mechbox.catalog.multi_chain_archive_note"}}</p>
        {{#if @model.design_chains.length}}
          <ul class="mechbox__tool-list">
            {{#each @model.design_chains as |chain|}}
              <li>
                <div>
                  <div class="mechbox__tool-name">{{chain.name}}</div>
                  <span class="mechbox__tool-badge">{{i18n
                      "mechbox.catalog.status.deferred"
                    }}</span>
                </div>
              </li>
            {{/each}}
          </ul>
        {{/if}}
      </aside>
    </div>
  </section>
</template>
