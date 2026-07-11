import { i18n } from "discourse-i18n";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <p>
        <a href="/mechbox" data-auto-route="true" class="mechbox__back-link">
          {{i18n "mechbox.back_to_home"}}
        </a>
      </p>
      <h1>{{@controller.model.name}}</h1>
      <p class="mechbox__disclaimer">{{@controller.model.description}}</p>
    </header>

    {{#if @controller.model.available}}
      <div class="mechbox__workbench-panel">
        <h2>{{i18n "mechbox.workbench_title"}}</h2>

        {{#each @controller.model.inputs as |input|}}
          <label class="mechbox__input-label">{{input.key}}</label>
          <input type="text" class="mechbox__inputs" name={{input.key}} />
        {{/each}}

        <p class="mechbox__disclaimer">
          {{i18n "mechbox.calculate"}}
        </p>
      </div>
    {{else}}
      <p>{{i18n "mechbox.tool_not_available"}}</p>
    {{/if}}
  </section>
</template>
