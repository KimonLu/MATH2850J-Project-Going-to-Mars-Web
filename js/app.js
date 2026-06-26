/* app.js -- tab navigation, language toggle, KaTeX rendering, lifecycle. */
(function (global) {
  "use strict";
  const MODS = {
    hohmann: global.ModHohmann,
    porkchop: global.ModPork,
    three: global.ModThree,
    formulas: global.ModFormulas,
  };
  let current = "hohmann";

  // KaTeX auto-render helper (with a \mars macro used in our formulas)
  global.renderMath = function (el) {
    if (!global.renderMathInElement || !el) return;
    try {
      global.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        macros: { "\\mars": "{\\text{M}}" },
        throwOnError: false,
      });
    } catch (e) { /* ignore */ }
  };

  function show(tab) {
    if (MODS[current] && MODS[current].onHide) MODS[current].onHide();
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === tab));
    current = tab;
    if (MODS[tab] && MODS[tab].onShow) MODS[tab].onShow();
  }

  global.onLangChange = function () {
    document.getElementById("langBtn").textContent = global.I18N.getLang() ? "中文" : "EN";
    Object.values(MODS).forEach(m => m && m.setLang && m.setLang());
  };

  window.addEventListener("DOMContentLoaded", () => {
    Object.values(MODS).forEach(m => m && m.init && m.init());
    document.querySelectorAll(".tab").forEach(t => t.onclick = () => show(t.dataset.tab));
    document.getElementById("langBtn").onclick = () => global.I18N.setLang(global.I18N.getLang() ? 0 : 1);
    global.I18N.apply();
    show("hohmann");
  });
})(window);
