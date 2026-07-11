import { i18n } from "discourse-i18n";
import { LinkTo } from "@ember/routing";
import { concat } from "@ember/helper";

export default <template>
  <section class="mechbox__page">
    <header class="mechbox__header">
      <h1>{{i18n "mechbox.title"}}</h1>
      <p class="mechbox__disclaimer">{{i18n "mechbox.disclaimer"}}</p>
    </header>

    {{outlet}}
  </section>
</template>
