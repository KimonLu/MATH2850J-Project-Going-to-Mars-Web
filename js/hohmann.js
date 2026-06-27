/* Module 1: Hohmann transfer animation (2-D heliocentric top view). */
(function (global) {
  "use strict";
  const A = global.Astro;
  let cv, ctx, raf = null, playing = true;
  let r1 = 1.0, r2 = 1.52, speed = 1.0;      // AU
  let clock = 0;                              // seconds of sim time
  let H = null;

  function recompute() {
    H = A.hohmann(r1 * A.AU, r2 * A.AU);
    const fmt = (x, u, d) => x.toFixed(d) + " " + u;
    set("hDv1", fmt(H.dv1 / 1e3, "km/s", 3));
    set("hDv2", fmt(H.dv2 / 1e3, "km/s", 3));
    set("hDvt", fmt(H.dvTotal / 1e3, "km/s", 3));
    set("hTof", fmt(H.tof / A.DAY, global.I18N.getLang() ? "d" : "天", 1));
    set("hSyn", (H.Tsyn / A.DAY).toFixed(0) + (global.I18N.getLang() ? " d" : " 天"));
    set("hPh", (H.alpha * 180 / Math.PI).toFixed(1) + "°");
  }
  function set(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  function draw() {
    const W = cv.width, Hh = cv.height, cx = W / 2, cy = Hh / 2;
    const margin = 46;
    const sc = (Math.min(W, Hh) / 2 - margin) / Math.max(r2, 1.0);
    ctx.clearRect(0, 0, W, Hh);
    // starfield
    ctx.fillStyle = "#070b15"; ctx.fillRect(0, 0, W, Hh);
    drawStars(ctx, W, Hh);

    const n_E = 2 * Math.PI / H.Te, n_M = 2 * Math.PI / H.Tm;
    const cycle = H.tof + 80 * A.DAY;          // transfer + short hold
    const tt = clock % cycle;
    const inTransit = tt <= H.tof;
    const s = Math.min(tt / H.tof, 1);         // 0..1 transfer progress

    // planet angles, aligned so departure=0, arrival=pi
    const thE = 0 + n_E * tt;
    const thM = H.alpha + n_M * tt;

    // orbits
    ringFill(ctx, cx, cy, r1 * sc, "rgba(58,123,213,.10)");
    ring(ctx, cx, cy, r1 * sc, "#3a7bd5");
    ring(ctx, cx, cy, r2 * sc, "#e0673a");

    // transfer ellipse (focus at Sun, perihelion +x)
    drawTransfer(ctx, cx, cy, sc);

    // Sun
    glow(ctx, cx, cy, 13, "#ffcc55", "#ff9900");

    // planets
    const pE = pos(cx, cy, sc, r1, thE);
    const pM = pos(cx, cy, sc, r2, thM);
    glow(ctx, pE.x, pE.y, 7, "#7fb3ff", "#3a7bd5");
    glow(ctx, pM.x, pM.y, 7, "#ff9d6e", "#e0673a");

    // spacecraft along transfer ellipse
    const at = H.at / A.AU, et = H.et, p = at * (1 - et * et);
    // Kepler timing: mean anomaly advances linearly (equal-area law),
    // so M = pi*s over the half-ellipse; solve for the true anomaly.
    const M = Math.PI * s;
    const E = A.solveKepler(M, et);
    const nu = A.trueFromEcc(E, et);
    const rr = p / (1 + et * Math.cos(nu));
    const px = cx + rr * sc * Math.cos(nu);
    const py = cy - rr * sc * Math.sin(nu);
    if (inTransit) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.stroke();
    }

    // labels
    ctx.fillStyle = "#9aa7c2"; ctx.font = "12px sans-serif";
    const L = global.I18N.getLang();
    ctx.fillText(L ? "Sun" : "太阳", cx + 8, cy - 10);
    ctx.fillStyle = "#7fb3ff"; ctx.fillText(L ? "Earth" : "地球", pE.x + 9, pE.y);
    ctx.fillStyle = "#ff9d6e"; ctx.fillText(L ? "Mars" : "火星", pM.x + 9, pM.y);
  }

  function drawTransfer(ctx, cx, cy, sc) {
    const at = (r1 + r2) / 2, et = (r2 - r1) / (r2 + r1), p = at * (1 - et * et);
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]); ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const nu = Math.PI * i / 200;
      const rr = p / (1 + et * Math.cos(nu));
      const x = cx + rr * sc * Math.cos(nu), y = cy - rr * sc * Math.sin(nu);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function pos(cx, cy, sc, r, th) { return { x: cx + r * sc * Math.cos(th), y: cy - r * sc * Math.sin(th) }; }
  function ring(ctx, cx, cy, R, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  }
  function ringFill(ctx, cx, cy, R, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  }
  function glow(ctx, x, y, r, c1, c2) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 1.8);
    g.addColorStop(0, c1); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  let stars = null;
  function drawStars(ctx, W, Hh) {
    if (!stars) { stars = []; for (let i = 0; i < 120; i++) stars.push([Math.random() * W, Math.random() * Hh, Math.random() * 1.3]); }
    ctx.fillStyle = "#cdd8f0";
    stars.forEach(s => { ctx.globalAlpha = 0.2 + 0.6 * Math.random() * 0; ctx.globalAlpha = 0.5; ctx.fillRect(s[0], s[1], s[2], s[2]); });
    ctx.globalAlpha = 1;
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (playing) clock += dt * speed * 12 * A.DAY;  // 1 real s ~ 12 sim days * speed
    draw();
    raf = requestAnimationFrame(loop);
  }

  const M = {
    init() {
      cv = document.getElementById("hohCanvas"); ctx = cv.getContext("2d");
      bind("hR1", v => { r1 = +v; document.getElementById("hR1v").textContent = r1.toFixed(2); recompute(); });
      bind("hR2", v => { r2 = +v; document.getElementById("hR2v").textContent = r2.toFixed(2); recompute(); });
      bind("hSpeed", v => { speed = +v; });
      document.getElementById("hPlay").onclick = function () {
        playing = !playing; this.textContent = playing ? global.I18N.t("play") : global.I18N.t("paused");
      };
      document.getElementById("hReset").onclick = () => { clock = 0; };
      document.getElementById("hMars").onclick = () => {
        r1 = 1.0; r2 = 1.52; clock = 0;
        document.getElementById("hR1").value = 1.0; document.getElementById("hR2").value = 1.52;
        document.getElementById("hR1v").textContent = "1.00"; document.getElementById("hR2v").textContent = "1.52";
        recompute();
      };
      recompute();
    },
    onShow() { last = 0; if (!raf) raf = requestAnimationFrame(loop); },
    onHide() { if (raf) { cancelAnimationFrame(raf); raf = null; } },
    setLang() { recompute(); },
  };
  function bind(id, fn) { const e = document.getElementById(id); e.addEventListener("input", () => fn(e.value)); }
  global.ModHohmann = M;
})(window);
