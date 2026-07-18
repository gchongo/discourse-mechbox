import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import {
  ensureKatex,
  fillFormulaBar,
  typesetRoot,
} from "./mechbox-tex";

const CALC_MODES = ["simple", "full", "professional"];

const TOOL_CONFIGS = {
  beam: {
    rootClass: "mechbox-standard mechbox-standard--beam",
    diagram: "beam",
    fields: [
      selectField("case_id", "Load case", [
        ["simply_center", "Simply supported, center load"],
        ["cantilever_end", "Cantilever, end load"],
        ["simply_uniform", "Simply supported, uniform load"],
        ["cantilever_uniform", "Cantilever, uniform load"],
      ], "simply_center"),
      selectField("section_type", "Section", [
        ["solid_round", "Solid round"],
        ["hollow_round", "Hollow round"],
        ["rectangle", "Rectangle"],
      ], "solid_round"),
      numberField("diameter_mm", "Outer diameter d", "30", "mm"),
      numberField("inner_diameter_mm", "Inner diameter d_i", "0", "mm"),
      numberField("width_mm", "Width b", "20", "mm"),
      numberField("height_mm", "Height h", "30", "mm"),
      numberField("span_length_mm", "Span length L", "500", "mm"),
      numberField("load_n", "Point load F", "2000", "N"),
      numberField("line_load_n_per_mm", "Line load q", "", "N/mm"),
      numberField("elastic_modulus_mpa", "Elastic modulus E", "206000", "MPa", { modes: "full professional" }),
      numberField("allowable_stress_mpa", "Allowable stress", "160", "MPa", { modes: "full professional" }),
      numberField("allowable_deflection_mm", "Allowable deflection", "1", "mm", { modes: "full professional" }),
      numberField("dynamic_factor", "Dynamic factor", "1.2", "-", { modes: "professional" }),
      numberField("stress_concentration", "Stress concentration Kt", "1.5", "-", { modes: "professional" }),
    ],
    formulas: {
      simple: {
        title: "Euler-Bernoulli beam",
        hint: "N-mm-MPa unit system. Uniform load uses q in N/mm, not total load.",
        formulas: ["\sigma=M/W", "\delta=F L^{3}/(48 E I)", "I_{round}=\pi d^{4}/64"],
      },
      full: {
        title: "Stress and deflection gates",
        hint: "Full mode checks allowable stress and deflection limits.",
        formulas: ["\eta_{\sigma}=\sigma/\sigma_{allow}", "\eta_{\delta}=\delta/\delta_{allow}"],
      },
      professional: {
        title: "Dynamic pre-check",
        hint: "Professional mode applies dynamic factor and stress concentration; no fatigue release is implied.",
        formulas: ["F_d=K_d F", "\sigma_d=K_t M/W"],
      },
    },
    results: [
      resultDef("moment_nmm", "Bending moment M", "N mm", 1),
      resultDef("stress_mpa", "Bending stress", "MPa", 3),
      resultDef("deflection_mm", "Deflection", "mm", 6),
      resultDef("inertia_mm4", "Second moment I", "mm^4", 3),
      resultDef("section_modulus_mm3", "Section modulus W", "mm^3", 3),
      resultDef("span_ratio", "Span ratio L/d", "", 3),
      resultDef("pass", "Engineering gate", "", 0),
    ],
  },
  structural: {
    rootClass: "mechbox-standard mechbox-standard--structural",
    diagram: "structural",
    fields: [
      selectField("analysis_type", "Analysis type", [
        ["pipe_flow", "Pipe flow"],
        ["plate_buckling", "Plate buckling"],
        ["modal", "Modal pre-check"],
      ], "pipe_flow"),
      numberField("diameter_mm", "Diameter d", "25", "mm", { analyses: "pipe_flow modal" }),
      numberField("length_m", "Pipe length L", "10", "m", { analyses: "pipe_flow" }),
      numberField("flow_rate_lpm", "Flow rate Q", "20", "L/min", { analyses: "pipe_flow" }),
      numberField("density_kg_m3", "Density", "998", "kg/m^3", { analyses: "pipe_flow", modes: "full professional" }),
      numberField("dynamic_viscosity_pa_s", "Dynamic viscosity", "0.001", "Pa s", { analyses: "pipe_flow", modes: "full professional" }),
      numberField("roughness_mm", "Roughness", "0.045", "mm", { analyses: "pipe_flow", modes: "full professional" }),
      numberField("local_loss_k", "Local loss K", "2", "-", { analyses: "pipe_flow", modes: "full professional" }),
      selectField("edge_condition", "Edge condition", [["ssss", "Simply supported"], ["cccc", "Clamped"]], "ssss", { analyses: "plate_buckling" }),
      numberField("thickness_mm", "Plate thickness t", "2", "mm", { analyses: "plate_buckling" }),
      numberField("width_mm", "Plate width b", "200", "mm", { analyses: "plate_buckling" }),
      numberField("length_mm", "Plate length a", "400", "mm", { analyses: "plate_buckling" }),
      numberField("applied_stress_mpa", "Applied stress", "50", "MPa", { analyses: "plate_buckling" }),
      selectField("case_id", "Modal case", [["sdof", "SDOF"], ["beam_ss", "Beam, simply supported"], ["beam_cantilever", "Beam, cantilever"]], "beam_ss", { analyses: "modal" }),
      numberField("stiffness_n_m", "Stiffness k", "10000", "N/m", { analyses: "modal" }),
      numberField("mass_kg", "Mass m", "10", "kg", { analyses: "modal" }),
      numberField("span_length_mm", "Span length L", "500", "mm", { analyses: "modal" }),
      numberField("elastic_modulus_mpa", "Elastic modulus E", "210000", "MPa", { analyses: "modal" }),
      numberField("excitation_freq_hz", "Excitation frequency", "0", "Hz", { analyses: "modal", modes: "full professional" }),
      numberField("rpm", "Rotating speed", "0", "rpm", { analyses: "modal", modes: "full professional" }),
    ],
    formulas: {
      simple: {
        title: "Structural pre-check",
        hint: "Pipe length is metres; plate/modal geometry uses mm. Keep units explicit.",
        formulas: ["\Delta p=f\frac{L}{D}\frac{\rho v^2}{2}", "\sigma_{cr}=k\pi^2E/[12(1-\nu^2)](t/b)^2", "f_n=\frac{1}{2\pi}\sqrt{k/m}"],
      },
      full: {
        title: "Limit checks",
        hint: "Full mode adds local loss, utilization, and resonance screening where inputs are provided.",
        formulas: ["\Delta p_{total}=\Delta p_{pipe}+\Delta p_{local}", "SF=\sigma_{cr}/\sigma_{applied}"],
      },
      professional: {
        title: "Engineering review mode",
        hint: "Use as a pre-check before CFD, FEA, or test validation.",
        formulas: ["r=f_{exc}/f_n", "v=4Q/(\pi D^2)"],
      },
    },
    results: [
      resultDef("analysis_type", "Analysis type", "", 0),
      resultDef("velocity_mps", "Velocity", "m/s", 4),
      resultDef("reynolds", "Reynolds number", "", 0),
      resultDef("total_pressure_drop_kpa", "Total pressure drop", "kPa", 4),
      resultDef("critical_stress_mpa", "Critical stress", "MPa", 3),
      resultDef("safety_factor", "Safety factor", "", 3),
      resultDef("modal.fn_hz", "Natural frequency", "Hz", 3),
      resultDef("pass", "Engineering gate", "", 0),
    ],
  },
  sheet_metal: {
    rootClass: "mechbox-standard mechbox-standard--sheet-metal",
    diagram: "sheet",
    fields: [
      selectField("method", "Method", [["k_factor", "K-factor allowance"], ["bend_deduction", "Bend deduction"]], "k_factor"),
      numberField("thickness_mm", "Thickness T", "1.5", "mm"),
      numberField("bend_radius_mm", "Inside radius R", "1.5", "mm"),
      numberField("k_factor", "K factor", "0.33", "0..0.5"),
      numberField("outer_sum_mm", "Outer dimension sum", "200", "mm", { methods: "bend_deduction" }),
      numberField("springback_deg", "Springback estimate", "0.5", "deg", { modes: "professional" }),
      textField("segments_json", "Segments JSON", '[{"type":"straight","length":50},{"type":"bend","angle":90},{"type":"straight","length":50}]', { wide: true }),
    ],
    formulas: {
      simple: {
        title: "K-factor unfold",
        hint: "Lengths are mm, bend angle is degrees. K must stay within 0..0.5.",
        formulas: ["BA=\frac{\pi}{180}\theta(R+KT)", "L_{flat}=\sum L_{straight}+\sum BA"],
      },
      full: {
        title: "Flange rule and bend deduction",
        hint: "Full mode checks minimum straight flange length and can use outside dimensions minus bend deduction.",
        formulas: ["BD=2(R+T)\tan(\theta/2)-BA", "L_{flat}=L_{outer}-\sum BD"],
      },
      professional: {
        title: "Springback estimate",
        hint: "Springback compensation is estimate-only and requires process validation.",
        formulas: ["L_{comp}=L_{flat}\left(1+\frac{\theta_s}{90n}\right)", "R_{min}=T"],
      },
    },
    results: [
      resultDef("method", "Method", "", 0),
      resultDef("flat_length_mm", "Flat length", "mm", 3),
      resultDef("compensated_flat_length_mm", "Compensated length", "mm", 3),
      resultDef("bend_count", "Bend count", "", 0),
      resultDef("min_flange_rule_mm", "Minimum flange rule", "mm", 3),
      resultDef("min_straight_length_mm", "Minimum straight length", "mm", 3),
      resultDef("flange_pass", "Flange gate", "", 0),
      resultDef("radius_pass", "Radius gate", "", 0),
      resultDef("springback_estimate_only", "Springback release", "", 0),
      resultDef("pass", "Engineering gate", "", 0),
    ],
  },
  cylinder: {
    rootClass: "mechbox-standard mechbox-standard--cylinder",
    diagram: "cylinder",
    fields: [
      selectField("cylinder_type", "Cylinder type", [["hydraulic", "Hydraulic"], ["pneumatic", "Pneumatic"]], "hydraulic"),
      numberField("bore_diameter_mm", "Bore diameter D", "50", "mm"),
      numberField("rod_diameter_mm", "Rod diameter d", "20", "mm"),
      numberField("pressure_mpa", "Pressure p", "16", "MPa"),
      numberField("flow_rate_lpm", "Flow rate Q", "20", "L/min"),
      numberField("velocity_mm_s", "Fallback velocity", "0", "mm/s"),
      numberField("external_load_n", "External load", "20000", "N", { modes: "full professional" }),
      numberField("stroke_length_mm", "Stroke length L", "300", "mm", { modes: "full professional" }),
      numberField("yield_strength_mpa", "Rod yield strength", "235", "MPa", { modes: "full professional" }),
      selectField("end_fixity", "Rod end fixity", [["pinned_pinned", "Pinned-pinned"], ["fixed_pinned", "Fixed-pinned"], ["fixed_fixed", "Fixed-fixed"], ["fixed_free", "Fixed-free"]], "pinned_pinned", { modes: "full professional" }),
      numberField("efficiency", "Pneumatic efficiency", "0.85", "0..1"),
      numberField("load_mass_kg", "Moved mass", "0", "kg", { modes: "professional" }),
      numberField("acceleration_m_s2", "Acceleration", "0", "m/s^2", { modes: "professional" }),
    ],
    formulas: {
      simple: {
        title: "Cylinder force and flow",
        hint: "Use MPa-mm-N: 1 MPa = 1 N/mm^2. Flow is L/min.",
        formulas: ["A=\pi D^2/4", "F=pA", "v=Q\cdot10^6/(60A)"],
      },
      full: {
        title: "Load margin and rod buckling",
        hint: "Rod diameter must be smaller than bore diameter; buckling is checked only under compression.",
        formulas: ["A_r=\pi(D^2-d^2)/4", "P_{cr}=\pi^2EI/(KL)^2"],
      },
      professional: {
        title: "Dynamic load pre-check",
        hint: "Pneumatic efficiency must be <= 1; dynamic load requires review against real motion profile.",
        formulas: ["F_d=m(g+a)", "t=L/v"],
      },
    },
    results: [
      resultDef("type", "Type", "", 0),
      resultDef("bore_area_mm2", "Bore area", "mm^2", 3),
      resultDef("annular_area_mm2", "Annular area", "mm^2", 3),
      resultDef("extend_force_n", "Extend force", "N", 1),
      resultDef("retract_force_n", "Retract force", "N", 1),
      resultDef("extend_velocity_mm_s", "Extend velocity", "mm/s", 3),
      resultDef("retract_velocity_mm_s", "Retract velocity", "mm/s", 3),
      resultDef("extend_margin_n", "Extend margin", "N", 1),
      resultDef("buckling_load_n", "Rod buckling load", "N", 1),
      resultDef("efficiency", "Efficiency", "", 3),
      resultDef("pass", "Engineering gate", "", 0),
    ],
  },
};

function numberField(name, label, value, unit, options = {}) {
  return { type: "number", name, label, value, unit, ...options };
}

function textField(name, label, value, options = {}) {
  return { type: "text", name, label, value, ...options };
}

function selectField(name, label, options, value, extra = {}) {
  return { type: "select", name, label, options, value, ...extra };
}

function resultDef(path, label, unit, digits) {
  return { path, label, unit, digits };
}

function modeLabel(mode) {
  if (mode === "simple") {
    return "Simplified";
  }
  if (mode === "full") {
    return "Full";
  }
  return "Professional";
}

function getCalcMode(root) {
  return root.dataset.calcMode || "simple";
}

function setCalcMode(root, mode) {
  root.dataset.calcMode = mode;
}

function getAnalysis(root) {
  return root.querySelector('[name="analysis_type"]')?.value || "";
}

function getMethod(root) {
  return root.querySelector('[name="method"]')?.value || "";
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "-";
  }
  return Number(num.toFixed(digits)).toString();
}

function formatValue(value, def) {
  if (value === true) {
    return "Pass";
  }
  if (value === false) {
    return "Needs attention";
  }
  if (value == null) {
    return "-";
  }
  if (typeof value === "number") {
    const unit = def.unit ? ` ${def.unit}` : "";
    return `${formatNumber(value, def.digits)}${unit}`;
  }
  return String(value);
}

function valueAt(object, path) {
  return path.split(".").reduce((memo, key) => memo?.[key], object);
}

function hideGenericPanel(panel) {
  ["mechbox__actions", "mechbox__error", "mechbox__result-title", "mechbox__result"].forEach((cls) => {
    const el = panel.querySelector(`.${cls}`);
    if (el) {
      el.hidden = true;
    }
  });
}

function fieldRow(rootClass, field) {
  const row = document.createElement("div");
  row.className = `${rootClass}__field`;
  if (field.wide) {
    row.classList.add(`${rootClass}__field--wide`);
  }
  if (field.modes) {
    row.dataset.calcShow = field.modes;
  }
  if (field.analyses) {
    row.dataset.analysisShow = field.analyses;
  }
  if (field.methods) {
    row.dataset.methodShow = field.methods;
  }

  const label = document.createElement("label");
  label.className = `${rootClass}__label`;
  label.htmlFor = `mechbox-${field.name}`;
  label.append(document.createTextNode(field.label));

  const controlWrap = document.createElement("div");
  controlWrap.className = `${rootClass}__control`;
  let control;

  if (field.type === "select") {
    control = document.createElement("select");
    control.className = `mechbox__inputs ${rootClass}__select`;
    field.options.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      if (value === field.value) {
        option.selected = true;
      }
      control.append(option);
    });
  } else if (field.type === "text") {
    control = document.createElement("textarea");
    control.className = `mechbox__inputs ${rootClass}__textarea`;
    control.rows = 4;
    control.value = field.value || "";
  } else {
    control = document.createElement("input");
    control.type = "text";
    control.inputMode = "decimal";
    control.className = `mechbox__inputs ${rootClass}__input`;
    control.value = field.value || "";
    control.dataset.type = "number";
  }

  control.id = `mechbox-${field.name}`;
  control.name = field.name;
  control.autocomplete = "off";
  if (field.type !== "number") {
    control.dataset.type = field.type;
  }
  controlWrap.append(control);

  const unit = document.createElement("span");
  unit.className = `${rootClass}__unit`;
  unit.textContent = field.unit || "";

  row.append(label, controlWrap, unit);
  return row;
}

function syncVisibility(root, config) {
  const mode = getCalcMode(root);
  const analysis = getAnalysis(root);
  const method = getMethod(root);

  root.querySelectorAll("[data-calc-show]").forEach((el) => {
    const modes = (el.dataset.calcShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", !modes.includes(mode));
  });

  root.querySelectorAll("[data-analysis-show]").forEach((el) => {
    const analyses = (el.dataset.analysisShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", analysis && !analyses.includes(analysis));
  });

  root.querySelectorAll("[data-method-show]").forEach((el) => {
    const methods = (el.dataset.methodShow || "").split(/\s+/).filter(Boolean);
    el.classList.toggle("is-mode-hidden", method && !methods.includes(method));
  });

  root.querySelectorAll("[data-calc-mode]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.calcMode === mode);
  });

  updateFormulaBar(root, config);
}

function updateFormulaBar(root, config) {
  const bar = root.querySelector(".mechbox-standard__formula-bar");
  if (!bar) {
    return;
  }
  const formulas = config.formulas[getCalcMode(root)] || config.formulas.simple;
  fillFormulaBar(bar, formulas);
  typesetRoot(bar);
}

function collectInputs(root, config) {
  const inputs = { calc_mode: getCalcMode(root) };
  config.fields.forEach((field) => {
    const control = root.querySelector(`[name="${field.name}"]`);
    if (!control) {
      return;
    }
    const raw = control.value;
    if (field.type === "number") {
      if (raw !== "") {
        inputs[field.name] = Number(raw);
      }
    } else {
      inputs[field.name] = raw;
    }
  });
  return inputs;
}

function resultRow(def, value) {
  const row = document.createElement("div");
  row.className = "mechbox-standard__result-row";
  if (value === false) {
    row.classList.add("is-danger");
  }
  const dt = document.createElement("dt");
  dt.textContent = def.label;
  const dd = document.createElement("dd");
  dd.textContent = formatValue(value, def);
  row.append(dt, dd);
  return row;
}

async function renderResults(panel, config, payload) {
  const body = panel.querySelector(".mechbox-standard__results-body");
  if (!body) {
    return;
  }
  const outputs = payload?.outputs || {};
  body.replaceChildren();
  body.classList.add("is-visible");

  const status = document.createElement("div");
  const estimate = outputs.estimate_only || outputs.springback_estimate_only;
  const pass = outputs.pass === true;
  status.className = `mechbox-standard__status ${pass ? "is-pass" : "is-attention"}`;
  status.textContent = `${config.resultsTitle || "Overall"}: ${estimate ? "Estimate / review" : pass ? "Pass" : "Needs attention"}`;
  body.append(status);

  const list = document.createElement("dl");
  list.className = "mechbox-standard__result-list";
  config.results.forEach((def) => {
    const value = valueAt(outputs, def.path);
    if (value != null) {
      list.append(resultRow(def, value));
    }
  });
  body.append(list);
  await typesetRoot(body);
}

function setError(panel, message) {
  const error = panel.querySelector(".mechbox-standard__error");
  if (!error) {
    return;
  }
  error.hidden = !message;
  error.textContent = message || "";
}

async function calculate(panel, config, button) {
  const root = panel.querySelector(".mechbox-standard");
  if (!root) {
    return;
  }
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = i18n("mechbox.calculating");
  setError(panel, null);

  try {
    const result = await ajax("/mechbox/api/calculate", {
      type: "POST",
      data: {
        tool_id: panel.dataset.toolId,
        save_record: false,
        inputs: collectInputs(root, config),
      },
    });
    await renderResults(panel, config, result);
  } catch (error) {
    const message = error?.jqXHR?.responseJSON?.errors?.join(" ");
    if (message) {
      setError(panel, message);
    } else {
      popupAjaxError(error);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function diagram(name) {
  const wrap = document.createElement("div");
  wrap.className = "mechbox-standard__diagram";
  wrap.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 280 150");
  svg.classList.add("mechbox-standard__svg");

  if (name === "beam") {
    svg.innerHTML = '<path d="M35 95 H245" stroke="currentColor" stroke-width="10" stroke-linecap="round" opacity=".35"/><path d="M60 105 l-14 26 h28z M220 105 l-14 26 h28z" fill="currentColor" opacity=".45"/><path d="M140 30 v52" stroke="var(--tertiary)" stroke-width="3" marker-end="url(#a)"/><text x="151" y="58" fill="var(--tertiary)" font-size="18">F</text><defs><marker id="a" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="var(--tertiary)"/></marker></defs><text x="132" y="124" fill="currentColor" font-size="16">L</text>';
  } else if (name === "cylinder") {
    svg.innerHTML = '<rect x="42" y="55" width="144" height="48" rx="8" fill="currentColor" opacity=".25"/><rect x="66" y="66" width="52" height="26" rx="4" fill="currentColor" opacity=".45"/><rect x="118" y="74" width="112" height="10" rx="5" fill="currentColor" opacity=".55"/><path d="M232 79 h26" stroke="var(--tertiary)" stroke-width="3" marker-end="url(#a)"/><defs><marker id="a" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="var(--tertiary)"/></marker></defs><text x="236" y="64" fill="var(--tertiary)" font-size="16">F</text><text x="80" y="122" fill="currentColor" font-size="16">D</text><text x="168" y="104" fill="currentColor" font-size="16">d</text>';
  } else if (name === "sheet") {
    svg.innerHTML = '<path d="M52 100 H128 Q150 100 150 78 V42" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" opacity=".35"/><path d="M126 92 Q143 91 150 75" fill="none" stroke="var(--tertiary)" stroke-width="3"/><text x="62" y="126" fill="currentColor" font-size="16">L</text><text x="151" y="89" fill="var(--tertiary)" font-size="16">R</text><text x="170" y="55" fill="currentColor" font-size="16">T</text>';
  } else {
    svg.innerHTML = '<path d="M44 98 H236" stroke="currentColor" stroke-width="12" stroke-linecap="round" opacity=".25"/><path d="M78 98 C100 52 136 52 158 98 S214 144 236 98" fill="none" stroke="var(--tertiary)" stroke-width="3"/><circle cx="72" cy="98" r="16" fill="currentColor" opacity=".35"/><text x="66" y="103" fill="var(--secondary)" font-size="14">Q</text><text x="138" y="46" fill="var(--tertiary)" font-size="16">f</text>';
  }

  const caption = document.createElement("p");
  caption.className = "mechbox-standard__diagram-caption";
  caption.textContent = "Parameter diagram / engineering pre-check";
  wrap.append(svg, caption);
  return wrap;
}

export async function mountStandardWorkbench(panel) {
  const toolId = panel.dataset.toolId;
  const config = TOOL_CONFIGS[toolId];
  const mount = panel.querySelector(".mechbox__form-mount");
  if (!config || !mount) {
    return false;
  }

  await ensureKatex();
  hideGenericPanel(panel);
  panel.classList.add("mechbox__workbench-panel--standard");
  mount.replaceChildren();

  const root = document.createElement("div");
  root.className = config.rootClass;
  setCalcMode(root, "simple");

  const modes = document.createElement("div");
  modes.className = "mechbox-standard__modes";
  CALC_MODES.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mechbox-standard__mode-tab";
    btn.dataset.calcMode = mode;
    btn.textContent = modeLabel(mode);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      setCalcMode(root, mode);
      syncVisibility(root, config);
    });
    modes.append(btn);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "mechbox-standard__formula-bar";

  const grid = document.createElement("div");
  grid.className = "mechbox-standard__grid";

  const inputsCard = document.createElement("section");
  inputsCard.className = "mechbox-standard__card";
  const inputsTitle = document.createElement("h3");
  inputsTitle.textContent = "Input parameters";
  inputsCard.append(inputsTitle);
  config.fields.forEach((field) => inputsCard.append(fieldRow("mechbox-standard", field)));
  inputsCard.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", () => syncVisibility(root, config));
  });
  inputsCard.append(diagram(config.diagram));

  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn btn-primary mechbox-standard__calculate-btn";
  calcBtn.textContent = i18n("mechbox.calculate");
  calcBtn.addEventListener("click", (event) => {
    event.preventDefault();
    calculate(panel, config, calcBtn);
  });
  inputsCard.append(calcBtn);

  const error = document.createElement("p");
  error.className = "mechbox-standard__error";
  error.hidden = true;
  inputsCard.append(error);

  const resultsCard = document.createElement("section");
  resultsCard.className = "mechbox-standard__card mechbox-standard__results";
  const resultsTitle = document.createElement("h3");
  resultsTitle.textContent = "Calculation results";
  const resultsBody = document.createElement("div");
  resultsBody.className = "mechbox-standard__results-body";
  const empty = document.createElement("div");
  empty.className = "mechbox-standard__results-empty";
  empty.textContent = "Fill the left panel and click Calculate to see results here.";
  resultsBody.append(empty);
  resultsCard.append(resultsTitle, resultsBody);

  grid.append(inputsCard, resultsCard);
  root.append(modes, formulaBar, grid);
  mount.append(root);
  syncVisibility(root, config);
  await typesetRoot(root);
  panel.dataset.mounted = "true";
  return true;
}

export function isStandardTool(toolId) {
  return Object.prototype.hasOwnProperty.call(TOOL_CONFIGS, toolId);
}