import { i18n } from "discourse-i18n";
import { LinkTo } from "@ember/routing";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <p>
        <LinkTo @route="mechbox">{{i18n "mechbox.back_to_home"}}</LinkTo>
      </p>
      <h1>{{@controller.model.name}}</h1>
      <p class="mechbox__disclaimer">{{@controller.model.description}}</p>
    </header>

    {{#if @controller.model.available}}
      <div class="mechbox__workbench-panel">
        <h2>{{i18n "mechbox.workbench_title"}}</h2>

        {{#each @controller.model.inputs as |input|}}
          <label class="mechbox__input-label">{{input.key}}</label>
          <input
            type="text"
            class="mechbox__inputs"
            value={{@controller.inputValueFor input.key}}
            {{on "input" (fn @controller.updateInput input.key)}}
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
  </section>
</template>
