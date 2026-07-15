import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

function t(key, options) {
  return i18n(`mechbox.gdt.${key}`, options);
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function numberField(name, labelText, value, hintText) {
  const row = document.createElement("div");
  row.className = "mechbox-gdt__field";

  const label = document.createElement("label");
  label.className = "mechbox-gdt__label";
  label.htmlFor = `mechbox-gdt-${name}`;
  label.textContent = labelText;

  const input = document.createElement("input");
  input.id = `mechbox-gdt-${name}`;
  input.className = "mechbox-gdt__control mechbox__inputs";
  input.type = "number";
  input.name = name;
  input.dataset.type = "number";
  input.step = "any";
  input.autocomplete = "off";
  if (value !== undefined) {
    input.value = value;
  }

  row.append(label, input);

  if (hintText) {
    const hint = document.createElement("p");
    hint.className = "mechbox-gdt__hint";
    hint.textContent = hintText;
    row.append(hint);
  }

  return { row, input };
}

export function mountGdtWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove("mechbox__workbench-panel--bolt");
  panel.classList.add("mechbox__workbench-panel--gdt");
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-gdt";

  const grid = document.createElement("div");
  grid.className = "mechbox-gdt__grid";

  const formCard = document.createElement("section");
  formCard.className = "mechbox-gdt__card";

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-gdt__card mechbox-gdt__results";

  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-gdt__results-body";
  resultsBody.innerHTML = `<p class="mechbox-gdt__empty">${t("results_empty")}</p>`;

  const { row: xRow, input: xInput } = numberField(
    "deviation_x_mm",
    t("deviation_x"),
    "0.05"
  );
  const { row: yRow, input: yInput } = numberField(
    "deviation_y_mm",
    t("deviation_y"),
    "0.05"
  );
  const { row: tolRow, input: tolInput } = numberField(
    "tolerance_diameter_mm",
    t("tolerance"),
    "",
    t("tolerance_hint")
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-gdt__calculate-btn";
  calcBtn.textContent = t("calculate");

  const actions = document.createElement("div");
  actions.className = "mechbox-gdt__actions";
  actions.append(calcBtn);

  formCard.append(xRow, yRow, tolRow, actions);

  resultsCard.append(
    Object.assign(document.createElement("h3"), {
      className: "mechbox-gdt__results-title",
      textContent: t("results_title"),
    }),
    resultsBody
  );

  grid.append(formCard, resultsCard);
  root.append(grid);
  mount.append(root);

  calcBtn.addEventListener("click", async () => {
    const original = calcBtn.textContent;
    calcBtn.disabled = true;
    calcBtn.textContent = i18n("mechbox.calculating");

    const inputs = {
      deviation_x_mm: Number(xInput.value),
      deviation_y_mm: Number(yInput.value),
    };

    if (tolInput.value !== "") {
      inputs.tolerance_diameter_mm = Number(tolInput.value);
    }

    try {
      const result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: "gdt_position",
          save_record: false,
          inputs,
        },
      });

      const outputs = result?.outputs || {};
      resultsBody.replaceChildren();

      const hero = document.createElement("div");
      hero.className = "mechbox-gdt__hero";
      hero.innerHTML = `
        <span class="mechbox-gdt__hero-label">${t("result_position")}</span>
        <span class="mechbox-gdt__hero-value">\u2300 ${formatNumber(
          outputs.position_diameter_mm
        )} mm</span>
      `;
      resultsBody.append(hero);

      if (outputs.pass !== undefined && outputs.pass !== null) {
        const status = document.createElement("p");
        status.className = `mechbox-gdt__status ${
          outputs.pass ? "is-pass" : "is-fail"
        }`;
        status.textContent = outputs.pass ? t("status_pass") : t("status_fail");
        resultsBody.append(status);

        const list = document.createElement("dl");
        list.className = "mechbox-gdt__dl";
        const rows = [
          [t("result_tolerance"), `\u2300 ${formatNumber(outputs.tolerance_diameter_mm)} mm`],
          [t("result_margin"), `${formatNumber(outputs.margin_mm)} mm`],
          [
            t("result_utilization"),
            `${formatNumber(Number(outputs.utilization) * 100, 1)} %`,
          ],
        ];
        for (const [k, v] of rows) {
          const dt = document.createElement("dt");
          dt.textContent = k;
          const dd = document.createElement("dd");
          dd.textContent = v;
          list.append(dt, dd);
        }
        resultsBody.append(list);
      }

      const formula = document.createElement("p");
      formula.className = "mechbox-gdt__formula";
      formula.textContent = t("formula");
      resultsBody.append(formula);
    } catch (error) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        resultsBody.replaceChildren();
        const err = document.createElement("p");
        err.className = "mechbox-gdt__error";
        err.textContent = error.jqXHR.responseJSON.errors.join(" ");
        resultsBody.append(err);
      } else {
        popupAjaxError(error);
      }
    } finally {
      calcBtn.disabled = false;
      calcBtn.textContent = original;
    }
  });

  panel.dataset.mounted = "true";
}
