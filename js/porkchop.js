/* Module 2: interactive Lambert porkchop (departure x time-of-flight) +
 * linked trajectory.  Click anywhere on the plot to select a date pair. */
(function (global) {
  "use strict";
  const A = global.Astro;
  let cv, ctx, tcv, tctx, grid = null, winIdx = 0, sel = null;
  const PAD = { l: 54, r: 12, t: 12, b: 36 };

  // Verified Earth-Mars launch windows: scan-start (year, month) chosen so the
  // window sits inside the 500-day departure scan.  Spacing ~ synodic period.
  const WINDOWS = [
    { label: "2026", y: 2026, m: 7 },
    { label: "2028", y: 2028, m: 8 },
    { label: "2031", y: 2030, m: 10 },
    { label: "2033", y: 2033, m: 1 },
    { label: "2035", y: 2035, m: 3 },
  ];

  function jdToDate(jd) {
    jd += 0.5; let Z = Math.floor(jd), F = jd - Z, Aa;
    if (Z < 2299161) Aa = Z; else { const al = Math.floor((Z - 1867216.25) / 36524.25); Aa = Z + 1 + al - Math.floor(al / 4); }
    const B = Aa + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + F, month = E < 14 ? E - 1 : E - 13, yr = month > 2 ? C - 4716 : C - 4715;
    const p = n => (n < 10 ? "0" : "") + n;
    return yr + "-" + p(month) + "-" + p(Math.floor(day));
  }

  const CMAP = [[68,1,84],[59,82,139],[33,144,140],[93,201,99],[253,231,37]];
  function color(t) {
    t = Math.max(0, Math.min(1, t)); const x = t * (CMAP.length - 1); const i = Math.floor(x), f = x - i;
    const a = CMAP[i], b = CMAP[Math.min(i + 1, CMAP.length - 1)];
    return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
  }

  function compute() {
    const w = WINDOWS[winIdx];
    const depStart = A.julianDate(w.y, w.m, 1);
    const nD = 84, dStep = 6;                 // departures (~500 d)
    const tof0 = 80, tof1 = 380, tStep = 5;   // time of flight axis
    const nT = Math.floor((tof1 - tof0) / tStep) + 1;
    const dep = [], tofv = [];
    for (let j = 0; j < nD; j++) dep.push(depStart + j * dStep);
    for (let i = 0; i < nT; i++) tofv.push(tof0 + i * tStep);
    const sum = [], c3 = [], vinf = [];
    let mn = 1e9, mnIdx = [0, 0];
    for (let i = 0; i < nT; i++) {
      sum.push([]); c3.push([]); vinf.push([]);
      for (let j = 0; j < nD; j++) {
        const d = dep[j], arr = d + tofv[i];
        const rE = A.planetState("earth", d), rM = A.planetState("mars", arr);
        const tr = A.lambert(rE.r, rM.r, tofv[i] * A.DAY, A.MU_SUN, true);
        if (!tr) { sum[i].push(NaN); c3[i].push(NaN); vinf[i].push(NaN); continue; }
        const vd = A.norm(A.sub(tr.v1, rE.v)), va = A.norm(A.sub(tr.v2, rM.v));
        const s = (vd + va) / 1e3;
        sum[i].push(s); c3[i].push((vd / 1e3) ** 2); vinf[i].push(va / 1e3);
        if (s < mn) { mn = s; mnIdx = [i, j]; }
      }
    }
    grid = { dep, tofv, sum, c3, vinf, nD, nT, min: mn, minIdx: mnIdx };
  }

  function render() {
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#070b15"; ctx.fillRect(0, 0, W, H);
    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const cw = pw / grid.nD, ch = ph / grid.nT;
    const lo = grid.min, hi = grid.min + 6;
    for (let i = 0; i < grid.nT; i++) for (let j = 0; j < grid.nD; j++) {
      const v = grid.sum[i][j]; if (isNaN(v)) continue;
      ctx.fillStyle = color(1 - (v - lo) / (hi - lo));
      ctx.fillRect(PAD.l + j * cw, PAD.t + (grid.nT - 1 - i) * ch, cw + 1, ch + 1);
    }
    const oi = grid.minIdx[0], oj = grid.minIdx[1];
    ctx.strokeStyle = "#ff4d4d"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(PAD.l + (oj + 0.5) * cw, PAD.t + (grid.nT - 1 - oi + 0.5) * ch, 6, 0, 7); ctx.stroke();
    if (sel) {                                  // current selection (white crosshair)
      const sx = PAD.l + (sel[1] + 0.5) * cw, sy = PAD.t + (grid.nT - 1 - sel[0] + 0.5) * ch;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 12, sy); ctx.lineTo(sx - 4, sy); ctx.moveTo(sx + 4, sy); ctx.lineTo(sx + 12, sy);
      ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy - 4); ctx.moveTo(sx, sy + 4); ctx.lineTo(sx, sy + 12);
      ctx.stroke();
    }
    ctx.fillStyle = "#9aa7c2"; ctx.font = "10px sans-serif";
    ctx.fillText(jdToDate(grid.dep[0]).slice(0, 7), PAD.l, H - 8);
    ctx.fillText(jdToDate(grid.dep[grid.nD - 1]).slice(0, 7), W - 60, H - 8);
    ctx.fillText(global.I18N.getLang() ? "departure →" : "发射日 →", PAD.l + pw / 2 - 24, H - 8);
    ctx.save(); ctx.translate(13, PAD.t + ph / 2 + 24); ctx.rotate(-Math.PI / 2);
    ctx.fillText(global.I18N.getLang() ? "TOF (days) →" : "飞行时间 (天) →", 0, 0); ctx.restore();
    ctx.fillText(grid.tofv[0] + "", PAD.l - 26, H - PAD.b);
    ctx.fillText(grid.tofv[grid.nT - 1] + "", PAD.l - 28, PAD.t + 8);
  }

  function pickCell(mx, my) {
    const pw = cv.width - PAD.l - PAD.r, ph = cv.height - PAD.t - PAD.b;
    const cw = pw / grid.nD, ch = ph / grid.nT;
    const j = Math.floor((mx - PAD.l) / cw), iv = Math.floor((my - PAD.t) / ch), i = grid.nT - 1 - iv;
    if (j < 0 || j >= grid.nD || i < 0 || i >= grid.nT) return null;
    return [i, j];
  }

  function showCell(i, j) {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    if (isNaN(grid.sum[i][j])) { set("pcSum", "—"); return; }
    const dep = grid.dep[j], tof = grid.tofv[i], arr = dep + tof;
    set("pcDep", jdToDate(dep)); set("pcArr", jdToDate(arr));
    set("pcTof", tof + (global.I18N.getLang() ? " d" : " 天"));
    set("pcC3", grid.c3[i][j].toFixed(2) + " km²/s²");
    set("pcVinf", grid.vinf[i][j].toFixed(3) + " km/s");
    set("pcSum", grid.sum[i][j].toFixed(3) + " km/s");
    drawTraj(dep, arr);
  }

  function stateToElem(r, v) {
    const mu = A.MU_SUN, R = A.norm(r), V = A.norm(v);
    const h = A.cross(r, v), H = A.norm(h);
    const evec = A.sub(A.scale(A.cross(v, h), 1 / mu), A.scale(r, 1 / R));
    const e = A.norm(evec), a = -mu / (2 * (V * V / 2 - mu / R));
    const i = Math.acos(h[2] / H);
    const n = [-h[1], h[0], 0], N = Math.hypot(n[0], n[1]);
    let Om = N > 1e-12 ? Math.atan2(n[1], n[0]) : 0;
    let om = (N > 1e-12 && e > 1e-12) ? Math.acos(Math.max(-1, Math.min(1, (n[0]*evec[0]+n[1]*evec[1]) / (N*e)))) : 0;
    if (evec[2] < 0) om = 2 * Math.PI - om;
    let nu = Math.acos(Math.max(-1, Math.min(1, A.dot(evec, r) / (e * R))));
    if (A.dot(r, v) < 0) nu = 2 * Math.PI - nu;
    return { a, e, i, Om, om, nu };
  }

  function drawTraj(dep, arr) {
    const W = tcv.width, H = tcv.height, cx = W / 2, cy = H / 2;
    tctx.clearRect(0, 0, W, H); tctx.fillStyle = "#070b15"; tctx.fillRect(0, 0, W, H);
    const rE = A.planetState("earth", dep), rM = A.planetState("mars", arr);
    const tr = A.lambert(rE.r, rM.r, (arr - dep) * A.DAY, A.MU_SUN, true);
    const sc = (Math.min(W, H) / 2 - 30) / (1.7 * A.AU);
    const PX = p => cx + p[0] * sc, PY = p => cy - p[1] * sc;
    orbit(tctx, "earth", dep, 365.25, "#3a7bd5", cx, cy, sc);
    orbit(tctx, "mars", arr, 687, "#e0673a", cx, cy, sc);
    tctx.fillStyle = "#ffcc55"; tctx.beginPath(); tctx.arc(cx, cy, 6, 0, 7); tctx.fill();
    if (tr) {
      const el = stateToElem(rE.r, tr.v1), el2 = stateToElem(rM.r, tr.v2);
      let nu0 = el.nu, nu1 = el2.nu; if (nu1 < nu0) nu1 += 2 * Math.PI;
      tctx.strokeStyle = "#fff"; tctx.lineWidth = 1.8; tctx.beginPath();
      for (let k = 0; k <= 160; k++) {
        const nu = nu0 + (nu1 - nu0) * k / 160;
        const st = A.elementsToState(el.a, el.e, el.i, el.Om, el.om, nu);
        k ? tctx.lineTo(PX(st.r), PY(st.r)) : tctx.moveTo(PX(st.r), PY(st.r));
      }
      tctx.stroke();
    }
    dot(tctx, PX(rE.r), PY(rE.r), "#7fb3ff");
    dot(tctx, PX(rM.r), PY(rM.r), "#ff9d6e");
  }
  function orbit(c, name, jd0, per, col, cx, cy, sc) {
    c.strokeStyle = col; c.lineWidth = 1; c.globalAlpha = .8; c.beginPath();
    for (let k = 0; k <= 180; k++) {
      const st = A.planetState(name, jd0 + per * k / 180);
      const x = cx + st.r[0] * sc, y = cy - st.r[1] * sc;
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke(); c.globalAlpha = 1;
  }
  function dot(c, x, y, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }

  function setExplain() {
    const el = document.getElementById("pcExplain"); if (!el) return;
    const zh = "<b>Lambert 问题</b>：给定两端位置 $\\mathbf r_1,\\mathbf r_2$ 与飞行时间 $\\Delta t$，反解连接弧的速度 $\\mathbf v_1,\\mathbf v_2$。本图在「发射日 × 飞行时间」网格上逐点求解 Lambert，颜色为 $\\Sigma v_\\infty$，红圈为最优。<br><b>为何窗口年份不连续？</b> 地火发射窗口每个<b>会合周期</b> $T_{\\mathrm{syn}}=\\left|\\tfrac1{T_\\oplus}-\\tfrac1{T_{\\mathrm M}}\\right|^{-1}\\approx 2.135$ 年（约 26 个月）才出现一次，故只列出含窗口的年份，间隔2–3年、永不连续。";
    const en = "<b>Lambert's problem</b>: given endpoints $\\mathbf r_1,\\mathbf r_2$ and time of flight $\\Delta t$, solve for the velocities $\\mathbf v_1,\\mathbf v_2$. This plot solves Lambert over a (departure × time-of-flight) grid; colour is $\\Sigma v_\\infty$, red circle = optimum.<br><b>Why aren't the years consecutive?</b> A launch window recurs once per <b>synodic period</b> $T_{\\mathrm{syn}}=\\left|\\tfrac1{T_\\oplus}-\\tfrac1{T_{\\mathrm M}}\\right|^{-1}\\approx 2.135$ yr (~26 months), so only years containing a window are listed, spaced 2–3 yr apart.";
    el.innerHTML = global.I18N.getLang() ? en : zh;
    if (global.renderMath) global.renderMath(el);
  }

  function runCompute() {
    const st = document.getElementById("pcStatus"); st.textContent = global.I18N.t("p_computing");
    setTimeout(() => { compute(); sel = grid.minIdx.slice(); render(); st.textContent = global.I18N.t("p_done");
      showCell(sel[0], sel[1]); }, 30);
  }

  const M = {
    init() {
      cv = document.getElementById("pcCanvas"); ctx = cv.getContext("2d");
      tcv = document.getElementById("pcTraj"); tctx = tcv.getContext("2d");
      const yearSel = document.getElementById("pcYear");
      WINDOWS.forEach((w, k) => { const o = document.createElement("option"); o.value = k; o.textContent = w.label; yearSel.appendChild(o); });
      yearSel.value = 0; yearSel.onchange = () => { winIdx = +yearSel.value; runCompute(); };
      document.getElementById("pcCompute").onclick = runCompute;
      document.getElementById("pcOpt").onclick = () => { if (grid) { sel = grid.minIdx.slice(); render(); showCell(sel[0], sel[1]); } };
      cv.addEventListener("click", e => {
        if (!grid) return; const r = cv.getBoundingClientRect();
        const mx = (e.clientX - r.left) * cv.width / r.width, my = (e.clientY - r.top) * cv.height / r.height;
        const c = pickCell(mx, my); if (c) { sel = c; render(); showCell(c[0], c[1]); }
      });
    },
    onShow() { setExplain(); if (!grid) runCompute(); },
    onHide() {},
    setLang() { setExplain(); if (grid) { render(); showCell((sel||grid.minIdx)[0], (sel||grid.minIdx)[1]); } },
  };
  global.ModPork = M;
})(window);
