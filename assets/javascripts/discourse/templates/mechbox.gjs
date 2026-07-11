import { i18n } from "discourse-i18n";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__workbench-panel">
      <h2>{{i18n "mechbox.skeleton_title"}}</h2>
      <p>{{i18n "mechbox.skeleton_message"}}</p>
      <p>
        <strong>{{i18n "mechbox.api_prefix_label"}}:</strong>
        <code>/mechbox/api</code>
      </p>
      <p>{{i18n "mechbox.catalog.single_tool_directory_hint"}}</p>
    </div>
  </section>
</template>
