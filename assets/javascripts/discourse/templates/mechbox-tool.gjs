import { i18n } from "discourse-i18n";
import { LinkTo } from "@ember/routing";
import { on } from "@ember/modifier";
import { concat, fn } from "@ember/helper";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    <div class="mechbox__workbench-panel">
      <p>
        <LinkTo @route="mechbox">{{i18n "mechbox.back_to_home"}}</LinkTo>
      </p>

      <h2>{{@controller.model.name}}</h2>
      <p>{{@controller.model.description}}</p>

      {{#if @controller.model.available}}
        <div>
          {{#each @controller.model.inputs as |input|}}
            <label for={{concat "mechbox-input-" input.key}}>{{input.key}}</label>
            <input
              id={{concat "mechbox-input-" input.key}}
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
        </div>

        {{#if @controller.errorMessage}}
          <div class="alert alert-error">{{@controller.errorMessage}}</div>
        {{/if}}

        {{#if @controller.calculationResult}}
          <h3>{{i18n "mechbox.result_title"}}</h3>
          <pre class="mechbox__result">{{@controller.resultJson}}</pre>
        {{/if}}
      {{else}}
        <p>{{i18n "mechbox.tool_not_available"}}</p>
      {{/if}}
    </div>
  </section>
</template>
