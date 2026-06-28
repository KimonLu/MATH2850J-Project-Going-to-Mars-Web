/* DE440s/Lambert porkchop module: total-dv and C3 maps on departure-offset vs TOF axes. */
(function (global) {
  "use strict";

  const A = global.Astro;
  const SITE = global.MarsDE440sData;

  const VIRIDIS = [[68,1,84],[59,82,139],[33,144,140],[93,201,99],[253,231,37]];
  const DESIGNS = [
    ["minimum_total_dv", "opt_min_total", "#ffffff", "star"],
    ["minimum_c3", "opt_min_c3", "#ffcc55", "circle"],
    ["fast_within_0.5", "opt_fast", "#46c98b", "triangle"],
    ["balanced_pareto", "opt_pareto", "#ff6f91", "diamond"],
  ];
  const PAD = { l: 70, r: 20, t: 30, b: 72 };
  const PLOT_GAP = 88;
  const METRICS = [
    { key: "totalDv", titleZh: "总 Δv [km/s]", titleEn: "Total Δv [km/s]", clip: 12 },
    { key: "c3", titleZh: "C3 [km²/s²]", titleEn: "C3 [km²/s²]", clip: 65 },
  ];

  let cv, ctx, tcv, tctx, winSel, optSel, status;
  let winIdx = 0, grid = null, selected = null, plots = [];

  function lang() { return global.I18N && global.I18N.getLang ? global.I18N.getLang() : 0; }
  function text(key) { return global.I18N ? global.I18N.t(key) : key; }
  function unitDay() { return lang() ? " d" : " 天"; }
  function fmtDate(value) { return String(value || "-").replace("T", " ").replace("+00:00", "").replace(":00:00", ":00"); }
  function jd(value) { return A.jdFromIso(value); }

  function lerpColor(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const x = t * (stops.length - 1);
    const i = Math.floor(x), f = x - i;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ];
  }

  function makeGrid(w) {
    const depJds = w.depDates.map(jd);
    const tofDays = w.tofDays.map(Number);
    const dep0 = depJds[0];
    const rows = w.rows.map(r => {
      const depIndex = r[0], tofIndex = r[1];
      const depJd = depJds[depIndex], tof = tofDays[tofIndex], arrJd = depJd + tof;
      return {
        depIndex, tofIndex, depJd, depOffset: depJd - dep0, tof, arrJd,
        departure_date: w.depDates[depIndex],
        departure_datetime_utc: w.depDates[depIndex] + "T00:00:00+00:00",
        arrival_datetime_utc: A.jdToIso(arrJd),
        c3: r[2], vinfE: r[3], vinfM: r[4], leoDv: r[5], lmoDv: r[6],
        totalDv: r[7], transferAngle: r[8], inclination: r[9],
      };
    });
    const byCell = Array.from({ length: tofDays.length }, () => Array(depJds.length).fill(null));
    rows.forEach(row => { byCell[row.tofIndex][row.depIndex] = row; });
    const matrices = {};
    METRICS.forEach(metric => {
      matrices[metric.key] = byCell.map(row => row.map(cell => cell ? cell[metric.key] : NaN));
    });
    return {
      data: w, rows, byCell, depJds, tofDays, dep0, matrices,
      nD: depJds.length, nT: tofDays.length,
      depStep: Number(w.departureStepDays),
      tofStep: Number(w.tofStepDays),
      xMin: -Number(w.departureStepDays) / 2,
      xMax: depJds[depJds.length - 1] - dep0 + Number(w.departureStepDays) / 2,
      yMin: tofDays[0] - Number(w.tofStepDays) / 2,
      yMax: tofDays[tofDays.length - 1] + Number(w.tofStepDays) / 2,
    };
  }

  function nearestIndex(values, value) {
    let best = 0, err = Infinity;
    values.forEach((v, i) => {
      const e = Math.abs(v - value);
      if (e < err) { best = i; err = e; }
    });
    return best;
  }

  function normalizeRecord(r) {
    if (r.depJd !== undefined) return r;
    const depJd = jd(r.departure_datetime_utc || r.departure_date);
    const tof = Number(r.tof_days);
    return {
      departure_datetime_utc: r.departure_datetime_utc,
      departure_date: r.departure_date,
      arrival_datetime_utc: r.arrival_datetime_utc,
      arrival_date: r.arrival_date,
      tof, arrJd: depJd + tof, depJd, depOffset: depJd - grid.dep0,
      depIndex: nearestIndex(grid.depJds, depJd),
      tofIndex: nearestIndex(grid.tofDays, tof),
      c3: Number(r.c3_km2_s2 ?? r.c3),
      vinfE: Number(r.departure_vinf_km_s ?? r.vinfE),
      vinfM: Number(r.arrival_vinf_km_s ?? r.vinfM),
      leoDv: Number(r.leo_departure_dv_km_s ?? r.leoDv),
      lmoDv: Number(r.lmo_capture_dv_km_s ?? r.lmoDv),
      totalDv: Number(r.total_patched_dv_km_s ?? r.totalDv),
      transferAngle: Number(r.transfer_angle_deg ?? r.transferAngle ?? 0),
      inclination: Number(r.transfer_plane_inclination_deg ?? r.inclination ?? 0),
    };
  }

  function candidateRow(design) {
    const c = grid.data.candidates[design];
    return c ? normalizeRecord(c) : null;
  }

  function buildPlots() {
    const availW = cv.width - PAD.l - PAD.r;
    const availH = cv.height - PAD.t - PAD.b;
    const side = Math.min(availW - 34, (availH - PLOT_GAP) / 2);
    const x = PAD.l + Math.max(0, (availW - side - 30) / 2);
    plots = METRICS.map((metric, index) => ({
      key: metric.key,
      title: lang() ? metric.titleEn : metric.titleZh,
      x,
      y: PAD.t + index * (side + PLOT_GAP),
      w: side,
      h: side,
      cbarX: x + side + 16,
      lo: Math.min(...grid.rows.map(r => r[metric.key])),
      hi: metric.clip,
    }));
  }

  function xOf(plot, depOffset) {
    return plot.x + (depOffset - grid.xMin) / (grid.xMax - grid.xMin) * plot.w;
  }

  function yOf(plot, tof) {
    return plot.y + (grid.yMax - tof) / (grid.yMax - grid.yMin) * plot.h;
  }

  function sampleMetric(plot, depOffset, tof) {
    const fx = depOffset / grid.depStep;
    const fy = (tof - grid.tofDays[0]) / grid.tofStep;
    const x0 = Math.max(0, Math.min(grid.nD - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(grid.nT - 1, Math.floor(fy)));
    const x1 = Math.max(0, Math.min(grid.nD - 1, x0 + 1));
    const y1 = Math.max(0, Math.min(grid.nT - 1, y0 + 1));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const ty = Math.max(0, Math.min(1, fy - y0));
    const matrix = grid.matrices[plot.key];
    const v00 = matrix[y0][x0], v10 = matrix[y0][x1];
    const v01 = matrix[y1][x0], v11 = matrix[y1][x1];
    const a = v00 * (1 - tx) + v10 * tx;
    const b = v01 * (1 - tx) + v11 * tx;
    return a * (1 - ty) + b * ty;
  }

  function metricColor(plot, value) {
    const t = (Math.min(value, plot.hi) - plot.lo) / Math.max(1e-9, plot.hi - plot.lo);
    return lerpColor(VIRIDIS, 1 - t);
  }

  function drawHeatmap(plot) {
    const w = Math.round(plot.w), h = Math.round(plot.h);
    const img = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      const tof = grid.yMax - (py + 0.5) / h * (grid.yMax - grid.yMin);
      for (let px = 0; px < w; px++) {
        const depOffset = grid.xMin + (px + 0.5) / w * (grid.xMax - grid.xMin);
        const value = sampleMetric(plot, depOffset, tof);
        const [r, g, b] = metricColor(plot, value);
        const k = (py * w + px) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, Math.round(plot.x), Math.round(plot.y));
  }

  function drawAxes(plot) {
    ctx.save();
    ctx.strokeStyle = "#26304d";
    ctx.fillStyle = "#9aa7c2";
    ctx.lineWidth = 1.2;
    ctx.font = "11px sans-serif";
    ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);

    const xTicks = [0, 90, 180, 270, Math.round(grid.xMax - grid.depStep / 2)];
    xTicks.forEach(tick => {
      const x = xOf(plot, tick);
      ctx.beginPath(); ctx.moveTo(x, plot.y + plot.h); ctx.lineTo(x, plot.y + plot.h + 5); ctx.stroke();
      const label = `+${tick}`;
      ctx.fillText(label, x - ctx.measureText(label).width / 2, plot.y + plot.h + 20);
    });
    [140, 200, 260, 320, 360].forEach(tick => {
      const y = yOf(plot, tick);
      ctx.beginPath(); ctx.moveTo(plot.x - 5, y); ctx.lineTo(plot.x, y); ctx.stroke();
      ctx.fillText(String(tick), plot.x - 34, y + 4);
    });

    ctx.fillStyle = "#c8d2e8";
    ctx.fillText(plot.title, plot.x, plot.y - 10);
    ctx.fillStyle = "#9aa7c2";
    const xLabel = lang() ? "departure offset (days) →" : "发射日偏移（天）→";
    ctx.fillText(xLabel, plot.x + plot.w / 2 - ctx.measureText(xLabel).width / 2, plot.y + plot.h + 38);
    ctx.save();
    ctx.translate(22, plot.y + plot.h / 2 + 56);
    ctx.rotate(-Math.PI / 2);
    const yLabel = lang() ? "time of flight (days) ↑" : "飞行时间（天）↑";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
    if (plot.key === "totalDv") {
      ctx.fillStyle = "#6f7c99";
      const span = `${grid.data.depDates[0]} → ${grid.data.depDates[grid.data.depDates.length - 1]}`;
      ctx.fillText(span, plot.x, plot.y + plot.h + 54);
    }
    ctx.restore();
  }

  function drawColorbar(plot) {
    const x = plot.cbarX, y = plot.y + 20, w = 12, h = 126;
    if (x + w + 38 > cv.width) return;
    for (let i = 0; i < h; i++) {
      const value = plot.lo + (i / (h - 1)) * (plot.hi - plot.lo);
      const [r, g, b] = metricColor(plot, value);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y + i, w, 1);
    }
    ctx.strokeStyle = "#26304d";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "10px sans-serif";
    ctx.fillText(plot.lo.toFixed(1), x + 18, y + 4);
    ctx.fillText(`≥${plot.hi}`, x + 18, y + h);
    ctx.fillText(lang() ? "low" : "低", x - 3, y - 6);
  }

  function drawMarker(c, x, y, col, shape, size) {
    c.save();
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
    size = size || 6;
    if (shape === "star") {
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const r = k % 2 ? size * 0.45 : size;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); c.fill();
    } else if (shape === "triangle") {
      c.beginPath(); c.moveTo(x, y - size); c.lineTo(x - size, y + size); c.lineTo(x + size, y + size); c.closePath(); c.fill();
    } else if (shape === "diamond") {
      c.beginPath(); c.moveTo(x, y - size); c.lineTo(x + size, y); c.lineTo(x, y + size); c.lineTo(x - size, y); c.closePath(); c.fill();
    } else {
      c.beginPath(); c.arc(x, y, size * 0.85, 0, 7); c.stroke();
    }
    c.restore();
  }

  function drawLegend() {
    const lastPlot = plots[plots.length - 1];
    let x = lastPlot.x, y = lastPlot.y + lastPlot.h + 56;
    ctx.font = "10.5px sans-serif";
    DESIGNS.forEach(([design, label, col, shape]) => {
      drawMarker(ctx, x + 6, y - 4, col, shape, 5);
      ctx.fillStyle = "#9aa7c2";
      ctx.fillText(text(label), x + 16, y);
      x += lang() ? 118 : 126;
    });
  }

  function render() {
    if (!grid) return;
    buildPlots();
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#070b15";
    ctx.fillRect(0, 0, cv.width, cv.height);

    plots.forEach(plot => {
      drawHeatmap(plot);
      drawAxes(plot);
      drawColorbar(plot);

      DESIGNS.forEach(([design, , col, shape]) => {
        const row = candidateRow(design);
        if (!row) return;
        drawMarker(ctx, xOf(plot, row.depOffset), yOf(plot, row.tof), col, shape, 7);
      });

      if (selected) {
        const x = xOf(plot, selected.depOffset), y = yOf(plot, selected.tof);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 7);
        ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y);
        ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
        ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5);
        ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15);
        ctx.stroke();
      }
    });
    drawLegend();
  }

  function pickCell(mx, my) {
    for (const plot of plots) {
      if (mx < plot.x || mx > plot.x + plot.w || my < plot.y || my > plot.y + plot.h) continue;
      const depOffset = grid.xMin + (mx - plot.x) / plot.w * (grid.xMax - grid.xMin);
      const tof = grid.yMax - (my - plot.y) / plot.h * (grid.yMax - grid.yMin);
      const j = nearestIndex(grid.depJds, grid.dep0 + depOffset);
      const i = nearestIndex(grid.tofDays, tof);
      return grid.byCell[i] && grid.byCell[i][j] ? grid.byCell[i][j] : null;
    }
    return null;
  }

  function showRecord(row) {
    selected = normalizeRecord(row);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("pcDep", fmtDate(selected.departure_datetime_utc || selected.departure_date));
    set("pcArr", fmtDate(selected.arrival_datetime_utc || selected.arrival_date));
    set("pcTof", selected.tof.toFixed(selected.tof % 1 ? 2 : 0) + unitDay());
    set("pcC3", selected.c3.toFixed(2) + " km²/s²");
    set("pcVinfE", selected.vinfE.toFixed(3) + " km/s");
    set("pcVinfM", selected.vinfM.toFixed(3) + " km/s");
    set("pcTotalDv", selected.totalDv.toFixed(3) + " km/s");
    render();
    drawTraj(selected);
  }

  function stateToElem(r, v) {
    const mu = A.MU_SUN, R = A.norm(r), V = A.norm(v);
    const h = A.cross(r, v), H = A.norm(h);
    const evec = A.sub(A.scale(A.cross(v, h), 1 / mu), A.scale(r, 1 / R));
    const e = A.norm(evec), a = -mu / (2 * (V * V / 2 - mu / R));
    const inc = Math.acos(Math.max(-1, Math.min(1, h[2] / H)));
    const n = [-h[1], h[0], 0], N = Math.hypot(n[0], n[1]);
    const Om = N > 1e-12 ? Math.atan2(n[1], n[0]) : 0;
    let om = (N > 1e-12 && e > 1e-12) ? Math.acos(Math.max(-1, Math.min(1, (n[0]*evec[0]+n[1]*evec[1]) / (N*e)))) : 0;
    if (evec[2] < 0) om = 2 * Math.PI - om;
    let nu = Math.acos(Math.max(-1, Math.min(1, A.dot(evec, r) / (e * R))));
    if (A.dot(r, v) < 0) nu = 2 * Math.PI - nu;
    return { a, e, inc, Om, om, nu };
  }

  function drawTraj(row) {
    const W = tcv.width, H = tcv.height, cx = W / 2, cy = H / 2;
    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = "#070b15";
    tctx.fillRect(0, 0, W, H);
    const dep = row.depJd, tof = row.tof, arr = row.arrJd;
    const rE = A.planetState("earth", dep), rM = A.planetState("mars", arr);
    const tr = A.lambert(rE.r, rM.r, tof * A.DAY, A.MU_SUN, true);
    const sc = (Math.min(W, H) / 2 - 30) / (1.75 * A.AU);
    const PX = p => cx + p[0] * sc, PY = p => cy - p[1] * sc;
    orbit(tctx, "earth", dep, 365.25, "#3a7bd5", cx, cy, sc);
    orbit(tctx, "mars", arr, 687, "#e0673a", cx, cy, sc);
    tctx.fillStyle = "#ffcc55";
    tctx.beginPath(); tctx.arc(cx, cy, 6, 0, 7); tctx.fill();
    if (tr) {
      const el = stateToElem(rE.r, tr.v1), endEl = stateToElem(rM.r, tr.v2);
      let nu0 = el.nu, nu1 = endEl.nu;
      if (nu1 < nu0) nu1 += 2 * Math.PI;
      tctx.strokeStyle = "#ffffff";
      tctx.lineWidth = 1.8;
      tctx.beginPath();
      for (let k = 0; k <= 180; k++) {
        const st = A.elementsToState(el.a, el.e, el.inc, el.Om, el.om, nu0 + (nu1 - nu0) * k / 180);
        k ? tctx.lineTo(PX(st.r), PY(st.r)) : tctx.moveTo(PX(st.r), PY(st.r));
      }
      tctx.stroke();
    }
    dot(tctx, PX(rE.r), PY(rE.r), "#7fb3ff");
    dot(tctx, PX(rM.r), PY(rM.r), "#ff9d6e");
  }

  function orbit(c, name, jd0, per, col, cx, cy, sc) {
    c.strokeStyle = col; c.lineWidth = 1; c.globalAlpha = 0.8; c.beginPath();
    for (let k = 0; k <= 180; k++) {
      const st = A.planetState(name, jd0 + per * k / 180);
      const x = cx + st.r[0] * sc, y = cy - st.r[1] * sc;
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke(); c.globalAlpha = 1;
  }

  function dot(c, x, y, col) {
    c.fillStyle = col; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill();
  }

  function setExplain() {
    const el = document.getElementById("pcExplain");
    if (!el) return;
    const zh = `
      <h3>什么是 Lambert 问题</h3>
      <p>给定太阳引力场中地球出发位置、火星到达位置和飞行时间，Lambert 问题求解连接两点的二体转移轨道。本页每一个格点都使用 DE440s 给出的真实行星边界状态，再求零圈顺行 Lambert 解。</p>
      <h3>为什么发射窗口不连续</h3>
      <p>发射日和飞行时间同时改变时，地球与火星的相对几何、转移角和所需能量都会变化。只有相位和能量匹配的区域会形成低能量斑块；其余区域会被高 C3、高到达超逸速度或 Lambert 几何分支切开，所以窗口不是一整片连续低能区域。</p>
      <h3>图像含义</h3>
      <p>上图颜色表示从 200 km LEO 出发并在 250 km LMO 捕获的 patched-conic 总 Δv；下图颜色表示发射 C3。两图横轴均为相对当前窗口起点的发射日偏移，纵轴均为飞行时间。颜色越亮表示对应指标越低；点击任一图都会在两图同步选择同一日期对，并更新右侧读数与轨迹。</p>`;
    const en = `
      <h3>What is the Lambert problem?</h3>
      <p>Given Earth's departure position, Mars' arrival position, and a chosen time of flight in the Sun's gravity field, Lambert's problem finds the two-body transfer orbit connecting the two points. Each grid point here uses DE440s planetary boundary states and a zero-revolution prograde Lambert solution.</p>
      <h3>Why is the launch window discontinuous?</h3>
      <p>Changing departure date and time of flight changes the Earth-Mars geometry, transfer angle, and required energy together. Low-energy patches appear only where phase and energy are compatible; high C3, high arrival hyperbolic excess speed, and Lambert-geometry branch changes split the map into separate usable regions.</p>
      <h3>How to read the plots</h3>
      <p>The upper map shows patched-conic total Δv for 200 km LEO departure plus 250 km LMO capture; the lower map shows launch C3. Both maps use departure offset on the x-axis and time of flight on the y-axis. Brighter colours mean lower values. Clicking either map selects the same date pair on both maps and updates the readout and trajectory.</p>`;
    el.innerHTML = lang() ? en : zh;
  }

  function fillSelectors() {
    winSel.innerHTML = "";
    SITE.windows.forEach((w, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = lang() ? w.labelEn : w.labelZh;
      winSel.appendChild(o);
    });
    winSel.value = String(winIdx);
    optSel.innerHTML = "";
    DESIGNS.forEach(([id, key]) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = text(key);
      optSel.appendChild(o);
    });
  }

  function loadWindow(index) {
    winIdx = index;
    grid = makeGrid(SITE.windows[winIdx]);
    selected = candidateRow("minimum_total_dv") || grid.rows[0];
    status.textContent = text("p_ready");
    showRecord(selected);
  }

  const M = {
    init() {
      cv = document.getElementById("pcCanvas"); ctx = cv.getContext("2d");
      tcv = document.getElementById("pcTraj"); tctx = tcv.getContext("2d");
      winSel = document.getElementById("pcWindow");
      optSel = document.getElementById("pcOptKind");
      status = document.getElementById("pcStatus");
      fillSelectors();
      winSel.onchange = () => loadWindow(+winSel.value);
      document.getElementById("pcFocus").onclick = () => {
        const row = candidateRow(optSel.value);
        if (row) showRecord(row);
      };
      cv.addEventListener("click", e => {
        if (!grid) return;
        const r = cv.getBoundingClientRect();
        const mx = (e.clientX - r.left) * cv.width / r.width;
        const my = (e.clientY - r.top) * cv.height / r.height;
        const row = pickCell(mx, my);
        if (row) showRecord(row);
      });
    },
    onShow() {
      setExplain();
      if (!grid) loadWindow(0);
      else { render(); drawTraj(selected); }
    },
    onHide() {},
    setLang() {
      fillSelectors();
      setExplain();
      if (grid && selected) showRecord(selected);
    },
  };

  global.ModPork = M;
})(window);
