import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

function t(key, options) {
  return i18n(`mechbox.rss.${key}`, options);
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toPrecision(10)).toString();
}

function parseValues(raw) {
  return String(raw || "")
    .split(/[\s,;，；]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function mountRssWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove("mechbox__workbench-panel--bolt");
  panel.classList.add("mechbox__workbench-panel--rss");
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-rss";

  const grid = document.createElement("div");
  grid.className = "mechbox-rss__grid";

  const formCard = document.createElement("section");
  formCard.className = "mechbox-rss__card";

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-rss__card mechbox-rss__results";

  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-rss__results-body";
  resultsBody.innerHTML = `<p class="mechbox-rss__empty">${t("results_empty")}</p>`;

  const label = document.createElement("label");
  label.className = "mechbox-rss__label";
  label.textContent = t("values");

  const textarea = document.createElement("textarea");
  textarea.className = "mechbox-rss__textarea";
  textarea.name = "values";
  textarea.rows = 8;
  textarea.placeholder = t("values_placeholder");
  textarea.value = "0.1\n0.2\n0.15";

  const hint = document.createElement("p");
  hint.className = "mechbox-rss__hint";
  hint.textContent = t("values_hint");

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-rss__calculate-btn";
  calcBtn.textContent = t("calculate");

  const actions = document.createElement("div");
  actions.className = "mechbox-rss__actions";
  actions.append(calcBtn);

  formCard.append(label, textarea, hint, actions);
  resultsCard.append(
    Object.assign(document.createElement("h3"), {
      className: "mechbox-rss__results-title",
      textContent: t("results_title"),
    }),
    resultsBody
  );

  grid.append(formCard, resultsCard);
  root.append(grid);
  mount.append(root);

  calcBtn.addEventListener("click", async () => {
    const values = parseValues(textarea.value);
    const original = calcBtn.textContent;
    calcBtn.disabled = true;
    calcBtn.textContent = i18n("mechbox.calculating");

    try {
      const result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: "rss_calculation",
          save_record: false,
          inputs: { values },
        },
      });

      const outputs = result?.outputs || {};
      resultsBody.replaceChildren();

      const list = document.createElement("dl");
      list.className = "mechbox-rss__dl";

      const rows = [
        [t("result_rss"), formatNumber(outputs.rss)],
        [t("result_count"), String(outputs.count ?? values.length)],
      ];

      for (const [k, v] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        list.append(dt, dd);
      }

      const formula = document.createElement("p");
      formula.className = "mechbox-rss__formula";
      formula.textContent = t("formula");

      resultsBody.append(list, formula);
    } catch (error) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        resultsBody.replaceChildren();
        const err = document.createElement("p");
        err.className = "mechbox-rss__error";
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
