/* Hohmann transfer animation for ideal coplanar circular orbits. */
(function (global) {
  "use strict";

  const A = global.Astro;
  const EARTH_AU = 1.00000261;
  const MARS_AU = 1.52371034;
  let cv, ctx, raf = null, playing = true;
  let r1 = EARTH_AU, r2 = MARS_AU, speed = 1.0, clock = 0, H = null;

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function lang() { return global.I18N && global.I18N.getLang ? global.I18N.getLang() : 0; }
  function dayUnit() { return lang() ? " d" : " 天"; }

  function recompute() {
    H = A.hohmann(r1 * A.AU, r2 * A.AU);
    set("hDv1", (H.dv1 / 1000).toFixed(3) + " km/s");
    set("hDv2", (H.dv2 / 1000).toFixed(3) + " km/s");
    set("hDvt", (H.dvTotal / 1000).toFixed(3) + " km/s");
    set("hTof", (H.tof / A.DAY).toFixed(1) + dayUnit());
    set("hSyn", (H.Tsyn / A.DAY / 365.25).toFixed(3) + (lang() ? " yr" : " 年"));
    set("hPh", (H.alpha * 180 / Math.PI).toFixed(1) + "°");
  }

  function draw() {
    const W = cv.width, Hh = cv.height, cx = W / 2, cy = Hh / 2;
    const margin = 46;
    const sc = (Math.min(W, Hh) / 2 - margin) / Math.max(r2, r1);
    ctx.clearRect(0, 0, W, Hh);
    ctx.fillStyle = "#070b15";
    ctx.fillRect(0, 0, W, Hh);
    drawStars(ctx, W, Hh);

    const n1 = 2 * Math.PI / H.Te, n2 = 2 * Math.PI / H.Tm;
    const cycle = H.tof + 80 * A.DAY;
    const tt = clock % cycle;
    const s = Math.min(tt / H.tof, 1);
    const thE = n1 * tt;
    const thM = H.alpha + n2 * tt;

    ringFill(ctx, cx, cy, r1 * sc, "rgba(58,123,213,.10)");
    ring(ctx, cx, cy, r1 * sc, "#3a7bd5");
    ring(ctx, cx, cy, r2 * sc, "#e0673a");
    drawTransfer(ctx, cx, cy, sc);
    glow(ctx, cx, cy, 13, "#ffcc55", "#ff9900");

    const pE = pos(cx, cy, sc, r1, thE);
    const pM = pos(cx, cy, sc, r2, thM);
    glow(ctx, pE.x, pE.y, 7, "#7fb3ff", "#3a7bd5");
    glow(ctx, pM.x, pM.y, 7, "#ff9d6e", "#e0673a");

    const at = H.at / A.AU, et = H.et, p = at * (1 - et * et);
    const E = A.solveKepler(Math.PI * s, et);
    const nu = A.trueFromEcc(E, et);
    const rr = p / (1 + et * Math.cos(nu));
    const px = cx + rr * sc * Math.cos(nu);
    const py = cy - rr * sc * Math.sin(nu);
    if (tt <= H.tof) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.stroke();
    }

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#9aa7c2"; ctx.fillText(lang() ? "Sun" : "太阳", cx + 8, cy - 10);
    ctx.fillStyle = "#7fb3ff"; ctx.fillText(lang() ? "Earth" : "地球", pE.x + 9, pE.y);
    ctx.fillStyle = "#ff9d6e"; ctx.fillText(lang() ? "Mars" : "火星", pM.x + 9, pM.y);
  }

  function drawTransfer(ctx, cx, cy, sc) {
    const at = (r1 + r2) / 2, et = (r2 - r1) / (r2 + r1), p = at * (1 - et * et);
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const nu = Math.PI * i / 200;
      const rr = p / (1 + et * Math.cos(nu));
      const x = cx + rr * sc * Math.cos(nu), y = cy - rr * sc * Math.sin(nu);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function pos(cx, cy, sc, r, th) {
    return { x: cx + r * sc * Math.cos(th), y: cy - r * sc * Math.sin(th) };
  }
  function ring(ctx, cx, cy, R, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  }
  function ringFill(ctx, cx, cy, R, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  }
  function glow(ctx, x, y, r, c1, c2) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 1.8);
    g.addColorStop(0, c1);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  let stars = null;
  function drawStars(ctx, W, Hh) {
    if (!stars) {
      stars = [];
      for (let i = 0; i < 120; i++) stars.push([Math.random() * W, Math.random() * Hh, Math.random() * 1.3]);
    }
    ctx.fillStyle = "#cdd8f0";
    stars.forEach(s => { ctx.globalAlpha = 0.5; ctx.fillRect(s[0], s[1], s[2], s[2]); });
    ctx.globalAlpha = 1;
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    if (playing) clock += dt * speed * 12 * A.DAY;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function setPreset() {
    r1 = EARTH_AU; r2 = MARS_AU; clock = 0;
    const r1El = document.getElementById("hR1"), r2El = document.getElementById("hR2");
    r1El.value = String(EARTH_AU);
    r2El.value = String(MARS_AU);
    set("hR1v", EARTH_AU.toFixed(4));
    set("hR2v", MARS_AU.toFixed(4));
    recompute();
  }

  function bind(id, fn) {
    const e = document.getElementById(id);
    e.addEventListener("input", () => fn(e.value));
  }

  const M = {
    init() {
      cv = document.getElementById("hohCanvas");
      ctx = cv.getContext("2d");
      document.getElementById("hR1").step = "0.0001";
      document.getElementById("hR2").step = "0.0001";
      bind("hR1", v => { r1 = +v; set("hR1v", r1.toFixed(4)); recompute(); });
      bind("hR2", v => { r2 = +v; set("hR2v", r2.toFixed(4)); recompute(); });
      bind("hSpeed", v => { speed = +v; });
      document.getElementById("hPlay").onclick = function () {
        playing = !playing;
        this.textContent = playing ? global.I18N.t("play") : global.I18N.t("paused");
      };
      document.getElementById("hReset").onclick = () => { clock = 0; };
      document.getElementById("hMars").onclick = setPreset;
      setPreset();
    },
    onShow() { last = 0; if (!raf) raf = requestAnimationFrame(loop); },
    onHide() { if (raf) { cancelAnimationFrame(raf); raf = null; } },
    setLang() { recompute(); },
  };

  global.ModHohmann = M;
})(window);
