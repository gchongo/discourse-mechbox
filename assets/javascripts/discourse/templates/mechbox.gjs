<template>
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
