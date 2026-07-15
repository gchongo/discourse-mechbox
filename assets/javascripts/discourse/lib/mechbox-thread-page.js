import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

const METRIC_THREAD_PITCH = {
  3: 0.5,
  4: 0.7,
  5: 0.8,
  6: 1.0,
  8: 1.25,
  10: 1.5,
  12: 1.75,
  14: 2.0,
  16: 2.0,
  18: 2.5,
  20: 2.5,
  22: 2.5,
  24: 3.0,
  27: 3.0,
  30: 3.5,
};

const GRADES = ["4.6", "4.8", "5.6", "8.8", "10.9", "12.9"];
const CALC_MODES = ["simple", "full", "professional"];

function t(key, options) {
  return i18n(`mechbox.thread.${key}`, options);
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  return Number(num.toFixed(digits)).toString();
}

function suggestedPitch(diameter) {
  return METRIC_THREAD_PITCH[Math.round(Number(diameter))] || 1.5;
}

function fieldRow(labelText, control, hintText) {
  const row = document.createElement("div");
  row.className = "mechbox-thread__field";

  const label = document.createElement("label");
  label.className = "mechbox-thread__label";
  label.textContent = labelText;

  row.append(label, control);

  if (hintText) {
    const hint = document.createElement("p");
    hint.className = "mechbox-thread__hint";
    hint.textContent = hintText;
    row.append(hint);
  }

  return row;
}

function numberInput(name, value, step = "any") {
  const input = document.createElement("input");
  input.className = "mechbox-thread__control mechbox__inputs";
  input.type = "number";
  input.name = name;
  input.dataset.type = "number";
  input.step = step;
  input.autocomplete = "off";
  input.value = value;
  return input;
}

function selectInput(name, options, selected) {
  const select = document.createElement("select");
  select.className = "mechbox-thread__control mechbox__inputs";
  select.name = name;
  select.dataset.type = "string";
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === selected) {
      option.selected = true;
    }
    select.append(option);
  }
  return select;
}

function setModeVisibility(root, mode) {
  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = el.getAttribute("data-calc-show").split(/\s+/);
    el.classList.toggle("is-mode-hidden", !modes.includes(mode));
  });
}

function appendDlRow(list, label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

export function mountThreadWorkbench(panel) {
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!mount) {
    return;
  }

  panel.classList.remove(
    "mechbox__workbench-panel--bolt",
    "mechbox__workbench-panel--units",
    "mechbox__workbench-panel--rss",
    "mechbox__workbench-panel--gdt"
  );
  panel.classList.add("mechbox__workbench-panel--thread");
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = "mechbox-thread";
  root.dataset.calcMode = "simple";

  const modeBar = document.createElement("div");
  modeBar.className = "mechbox-thread__modes";
  for (const mode of CALC_MODES) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "mechbox-thread__mode-tab";
    tab.dataset.calcMode = mode;
    tab.textContent = t(`mode_${mode}`);
    if (mode === "simple") {
      tab.classList.add("is-active");
    }
    modeBar.append(tab);
  }

  const grid = document.createElement("div");
  grid.className = "mechbox-thread__grid";

  const formCard = document.createElement("section");
  formCard.className = "mechbox-thread__card";

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-thread__card mechbox-thread__results";

  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-thread__results-body";
  resultsBody.innerHTML = `<p class="mechbox-thread__empty">${t("results_empty")}</p>`;

  const diameterInput = numberInput("diameter_mm", "12", "1");
  const pitchInput = numberInput("pitch_mm", "1.75", "0.25");
  const gradeSelect = selectInput(
    "grade",
    GRADES.map((g) => ({ value: g, label: g })),
    "8.8"
  );
  const forceInput = numberInput("axial_force_n", "25000", "500");
  const engagedInput = numberInput("engaged_length_mm", "18", "0.5");
  const frictionInput = numberInput("friction_coeff", "0.2", "0.05");
  const nutSelect = selectInput(
    "nut_material",
    [
      { value: "steel", label: t("nut_steel") },
      { value: "soft", label: t("nut_soft") },
    ],
    "steel"
  );
  const muGInput = numberInput("mu_g", "0.12", "0.02");
  const muKInput = numberInput("mu_k", "0.12", "0.02");
  const dKmInput = numberInput("d_km", String((1.45 * 12).toFixed(2)), "0.5");

  const pitchSuggest = document.createElement("button");
  pitchSuggest.type = "button";
  pitchSuggest.className = "btn btn-default btn-small mechbox-thread__suggest";
  pitchSuggest.textContent = t("use_standard_pitch");
  pitchSuggest.addEventListener("click", () => {
    pitchInput.value = String(suggestedPitch(diameterInput.value));
  });

  diameterInput.addEventListener("change", () => {
    pitchInput.value = String(suggestedPitch(diameterInput.value));
    dKmInput.value = String((1.45 * Number(diameterInput.value || 12)).toFixed(2));
    if (!engagedInput.dataset.touched) {
      engagedInput.value = String((1.5 * Number(diameterInput.value || 12)).toFixed(1));
    }
  });
  engagedInput.addEventListener("input", () => {
    engagedInput.dataset.touched = "true";
  });

  const frictionWrap = document.createElement("div");
  frictionWrap.dataset.calcShow = "simple";
  frictionWrap.append(fieldRow(t("friction_coeff"), frictionInput));

  const nutWrap = document.createElement("div");
  nutWrap.dataset.calcShow = "full professional";
  nutWrap.append(fieldRow(t("nut_material"), nutSelect));

  const vdiWrap = document.createElement("div");
  vdiWrap.dataset.calcShow = "professional";
  vdiWrap.append(
    fieldRow(t("mu_g"), muGInput),
    fieldRow(t("mu_k"), muKInput),
    fieldRow(t("d_km"), dKmInput, t("d_km_hint"))
  );

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-thread__calculate-btn";
  calcBtn.textContent = t("calculate");

  const actions = document.createElement("div");
  actions.className = "mechbox-thread__actions";
  actions.append(calcBtn);

  const pitchRow = fieldRow(t("pitch"), pitchInput);
  pitchRow.append(pitchSuggest);

  formCard.append(
    fieldRow(t("diameter"), diameterInput, t("diameter_hint")),
    pitchRow,
    fieldRow(t("grade"), gradeSelect),
    fieldRow(t("axial_force"), forceInput),
    fieldRow(t("engaged_length"), engagedInput),
    frictionWrap,
    nutWrap,
    vdiWrap,
    actions
  );

  resultsCard.append(
    Object.assign(document.createElement("h3"), {
      className: "mechbox-thread__results-title",
      textContent: t("results_title"),
    }),
    resultsBody
  );

  grid.append(formCard, resultsCard);
  root.append(modeBar, grid);
  mount.append(root);

  setModeVisibility(root, "simple");

  modeBar.addEventListener("click", (event) => {
    const tab = event.target.closest(".mechbox-thread__mode-tab");
    if (!tab) {
      return;
    }
    const mode = tab.dataset.calcMode;
    root.dataset.calcMode = mode;
    modeBar.querySelectorAll(".mechbox-thread__mode-tab").forEach((el) => {
      el.classList.toggle("is-active", el === tab);
    });
    setModeVisibility(root, mode);
  });

  calcBtn.addEventListener("click", async () => {
    const mode = root.dataset.calcMode || "simple";
    const original = calcBtn.textContent;
    calcBtn.disabled = true;
    calcBtn.textContent = i18n("mechbox.calculating");

    const inputs = {
      calc_mode: mode,
      diameter_mm: Number(diameterInput.value),
      pitch_mm: Number(pitchInput.value),
      grade: gradeSelect.value,
      axial_force_n: Number(forceInput.value),
      engaged_length_mm: Number(engagedInput.value),
    };

    if (mode === "simple") {
      inputs.friction_coeff = Number(frictionInput.value);
    } else {
      inputs.nut_material = nutSelect.value;
    }

    if (mode === "professional") {
      inputs.mu_g = Number(muGInput.value);
      inputs.mu_k = Number(muKInput.value);
      inputs.d_km = Number(dKmInput.value);
    }

    try {
      const result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: "thread",
          save_record: false,
          inputs,
        },
      });

      const outputs = result?.outputs || {};
      resultsBody.replaceChildren();

      const status = document.createElement("p");
      status.className = `mechbox-thread__status ${
        outputs.estimate_only
          ? "is-estimate"
          : outputs.pass
            ? "is-pass"
            : "is-fail"
      }`;
      status.textContent = outputs.estimate_only
        ? t("status_estimate")
        : outputs.pass
          ? t("status_pass")
          : t("status_fail");
      resultsBody.append(status);

      const list = document.createElement("dl");
      list.className = "mechbox-thread__dl";
      appendDlRow(
        list,
        t("result_stress_area"),
        `${formatNumber(outputs.stress_area_mm2)} mm²`
      );
      appendDlRow(
        list,
        t("result_diameters"),
        `${formatNumber(outputs.pitch_diameter_mm, 3)} / ${formatNumber(
          outputs.minor_diameter_mm,
          3
        )} mm`
      );
      appendDlRow(
        list,
        t("result_tensile"),
        `${formatNumber(outputs.tensile_stress_mpa, 1)} MPa`
      );
      appendDlRow(
        list,
        t("result_shear"),
        `${formatNumber(outputs.shear_stress_mpa, 1)} MPa`
      );
      appendDlRow(
        list,
        t("result_torque"),
        `${formatNumber(outputs.tightening_torque_nm)} N·m (${t(
          `torque_${outputs.torque_method}`
        )})`
      );
      appendDlRow(
        list,
        t("result_max_force"),
        `${formatNumber(outputs.max_allowable_force_n, 0)} N`
      );

      if (outputs.min_engagement_mm != null) {
        appendDlRow(
          list,
          t("result_min_engagement"),
          `${formatNumber(outputs.min_engagement_mm, 1)} mm`
        );
        appendDlRow(
          list,
          t("result_critical_side"),
          t(`side_${outputs.critical_shear_side}`)
        );
      }

      if (outputs.utilization != null) {
        appendDlRow(
          list,
          t("result_utilization"),
          `${formatNumber(Number(outputs.utilization) * 100, 1)} %`
        );
      }

      resultsBody.append(list);

      const formula = document.createElement("p");
      formula.className = "mechbox-thread__formula";
      formula.textContent =
        mode === "professional" ? t("formula_pro") : t("formula_simple");
      resultsBody.append(formula);
    } catch (error) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        resultsBody.replaceChildren();
        const err = document.createElement("p");
        err.className = "mechbox-thread__error";
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
