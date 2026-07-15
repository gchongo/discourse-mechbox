import loadScript from "discourse/lib/load-script";
import { isTesting } from "discourse/lib/environment";

const KATEX_CDN = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist";

let katexPromise;

async function loadKatexFromCdn() {
  await loadScript(`${KATEX_CDN}/katex.min.css`, { css: true });
  await loadScript(`${KATEX_CDN}/katex.min.js`);
  return window.katex;
}

export async function ensureKatex() {
  if (window.katex) {
    return window.katex;
  }

  if (!katexPromise) {
    katexPromise = (async () => {
      try {
        const mod = await import(
          "discourse/plugins/discourse-math/lib/load-katex"
        );
        const katex = await mod.default({
          enableMhchem: false,
          enableCopyTex: false,
        });
        if (katex || window.katex) {
          return katex || window.katex;
        }
      } catch {
        // discourse-math may be absent; fall through to CDN.
      }

      return await loadKatexFromCdn();
    })();
  }

  return katexPromise;
}

export function renderTex(target, tex, { displayMode = false } = {}) {
  if (!target) {
    return;
  }

  const source = String(tex || "");
  target.classList.add("mechbox-tex");
  target.dataset.tex = source;

  if (isTesting() || !window.katex) {
    target.textContent = displayMode ? `\\[${source}\\]` : `\\(${source}\\)`;
    return;
  }

  try {
    window.katex.render(source, target, {
      throwOnError: false,
      displayMode,
      output: "html",
    });
  } catch {
    target.textContent = source;
  }
}

export async function renderTexAsync(target, tex, options = {}) {
  await ensureKatex();
  renderTex(target, tex, options);
}

export async function typesetRoot(root) {
  if (!root) {
    return;
  }

  await ensureKatex();

  root.querySelectorAll("[data-tex]").forEach((el) => {
    renderTex(el, el.dataset.tex, {
      displayMode: el.dataset.display === "true",
    });
  });
}

export function texNode(tex, { displayMode = false, className = "" } = {}) {
  const el = document.createElement(displayMode ? "div" : "span");
  el.className = className || "mechbox-tex";
  el.dataset.tex = tex;
  if (displayMode) {
    el.dataset.display = "true";
  }
  el.textContent = displayMode ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  return el;
}

/** Title + optional hint in parentheses, then display-mode formulas. */
export function fillFormulaBar(bar, { title, hint, formulas = [] } = {}) {
  if (!bar) {
    return;
  }

  bar.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "mechbox-formula-heading";

  const titleEl = document.createElement("strong");
  titleEl.className = "mechbox-formula-title";
  titleEl.textContent = title || "";
  heading.append(titleEl);

  if (hint) {
    const hintEl = document.createElement("span");
    hintEl.className = "mechbox-formula-hint";
    hintEl.textContent = `（${hint}）`;
    heading.append(hintEl);
  }

  bar.append(heading);

  for (const formula of formulas) {
    if (!formula) {
      continue;
    }
    bar.append(texNode(formula, { displayMode: true }));
  }
}

export function mixedLabel(parts) {
  const wrap = document.createElement("span");
  wrap.className = "mechbox-bolt__mixed-label";

  for (const part of parts) {
    if (part.tex) {
      wrap.append(texNode(part.tex));
    } else if (part.text != null) {
      wrap.append(document.createTextNode(part.text));
    }
  }

  return wrap;
}
