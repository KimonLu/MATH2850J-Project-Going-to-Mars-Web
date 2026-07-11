/* Fly-by / slingshot teaching module for part iv. */
(function (global) {
  "use strict";

  const PLANETS = {
    venus: { label: "Venus", mu: 324858.592, radius: 6051.8, speed: 35.02, color: "#d8b06a", orbit: { rx: 92, ry: 54 } },
    earth: { label: "Earth", mu: 398600.435, radius: 6378.1, speed: 29.78, color: "#3a7bd5", orbit: { rx: 120, ry: 70 } },
    mars: { label: "Mars", mu: 42828.374, radius: 3396.2, speed: 24.13, color: "#e0673a", orbit: { rx: 185, ry: 108 } },
    jupiter: { label: "Jupiter", mu: 126686534.0, radius: 71492.0, speed: 13.07, color: "#d9a066", orbit: { rx: 292, ry: 168 } },
  };
  const ORBIT_ROT = -0.08;

  let cv, ctx, viewSel, planetSel, vinfSlider, altSlider, angleSlider, turnSel;
  let ready = false, raf = null, last = 0, clock = 0;
  let stars = null;

  function byId(id) { return document.getElementById(id); }
  function deg(rad) { return rad * 180 / Math.PI; }
  function rad(degValue) { return degValue * Math.PI / 180; }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function vlen(v) { return Math.hypot(v.x, v.y); }
  function fromAngle(angle, mag) { return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag }; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function state() {
    const planet = PLANETS[planetSel.value] || PLANETS.venus;
    const vinf = Number(vinfSlider.value);
    const alt = Number(altSlider.value);
    const incomingAngle = rad(Number(angleSlider.value));
    const sign = Number(turnSel.value);
    const rp = planet.radius + alt;
    const ecc = 1 + rp * vinf * vinf / planet.mu;
    const delta = 2 * Math.asin(clamp(1 / ecc, -1, 1));
    const vin = fromAngle(incomingAngle, vinf);
    const vout = fromAngle(incomingAngle + sign * delta, vinf);
    const vp = { x: planet.speed, y: 0 };
    const before = vadd(vp, vin);
    const after = vadd(vp, vout);
    return { planet, vinf, alt, rp, ecc, delta, incomingAngle, sign, vin, vout, vp, before, after };
  }

  function setReadouts(s) {
    byId("flyVinfv").textContent = s.vinf.toFixed(1);
    byId("flyAltv").textContent = s.alt.toFixed(0);
    byId("flyAnglev").textContent = String(Math.round(deg(s.incomingAngle)));
    byId("flyDelta").textContent = deg(s.delta).toFixed(1) + " deg";
    byId("flyEcc").textContent = s.ecc.toFixed(3);
    byId("flyRp").textContent = s.rp.toFixed(0) + " km";
    byId("flyBefore").textContent = vlen(s.before).toFixed(2) + " km/s";
    byId("flyAfter").textContent = vlen(s.after).toFixed(2) + " km/s";
    const gain = vlen(s.after) - vlen(s.before);
    byId("flyGain").textContent = (gain >= 0 ? "+" : "") + gain.toFixed(2) + " km/s";
    byId("flyGain").style.color = gain >= 0 ? "#46c98b" : "#ff9d6e";
  }

  function clear(title, subtitle) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, "#08101f");
    g.addColorStop(0.55, "#0a1326");
    g.addColorStop(1, "#100f1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);
    drawStars();
    ctx.fillStyle = "#e8edf7";
    ctx.font = "700 18px Segoe UI, sans-serif";
    ctx.fillText(title, 24, 34);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(subtitle, 24, 55);
  }

  function ensureStars() {
    if (stars) return;
    stars = [];
    for (let i = 0; i < 84; i++) {
      stars.push({
        x: ((i * 113) % 1000) / 1000,
        y: ((i * 67) % 1000) / 1000,
        r: i % 9 === 0 ? 1.3 : 0.7,
        phase: i * 0.37,
      });
    }
  }

  function drawStars() {
    ensureStars();
    stars.forEach(star => {
      ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(clock * 0.9 + star.phase));
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x * cv.width, star.y * cv.height, star.r, 0, 7);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function arrow(x1, y1, x2, y2, color, label) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(a - 0.45), y2 - 12 * Math.sin(a - 0.45));
    ctx.lineTo(x2 - 12 * Math.cos(a + 0.45), y2 - 12 * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(label, x2 + 8, y2 - 8);
    }
    ctx.restore();
  }

  function planet(cx, cy, r, p, label) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.2, p.color);
    g.addColorStop(1, "#1b2133");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.2)";
    ctx.stroke();
    const text = label || p.label;
    ctx.fillStyle = "#c8d2e8";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(text, cx - ctx.measureText(text).width / 2, cy + r + 20);
  }

  function glow(x, y, r, c1, c2) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
    g.addColorStop(0, c1);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  function samplePath(pts, t) {
    if (!pts.length) return null;
    if (pts.length === 1) return pts[0];
    const scaled = clamp(t, 0, 1) * (pts.length - 1);
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = pts[i];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
  }

  function traceSegment(pts, t0, t1, color) {
    if (!pts.length) return;
    const start = Math.max(0, Math.floor(clamp(t0, 0, 1) * (pts.length - 1)));
    const end = Math.max(start + 1, Math.min(pts.length - 1, Math.ceil(clamp(t1, 0, 1) * (pts.length - 1))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = start; i <= end; i++) {
      const pt = pts[i];
      i === start ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  function buildTimedPath(pts, kmPerPixel, s) {
    if (pts.length < 2) return pts;
    const cumulative = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dsKm = Math.hypot(b.x - a.x, b.y - a.y) * kmPerPixel;
      const rAvg = Math.max(1, (a.r + b.r) / 2);
      const vAvg = Math.sqrt(s.vinf * s.vinf + 2 * s.planet.mu / rAvg);
      total += dsKm / vAvg;
      cumulative.push(total);
    }
    return pts.map((pt, i) => ({ ...pt, tau: total ? cumulative[i] / total : 0 }));
  }

  function sampleTimedPath(pts, t) {
    if (!pts.length) return null;
    if (pts.length === 1) return pts[0];
    const tt = clamp(t, 0, 1);
    let hi = pts.findIndex(pt => pt.tau >= tt);
    if (hi <= 0) hi = 1;
    const lo = hi - 1;
    const a = pts[lo];
    const b = pts[Math.min(hi, pts.length - 1)];
    const span = Math.max(1e-6, b.tau - a.tau);
    const f = (tt - a.tau) / span;
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), r: lerp(a.r, b.r, f) };
  }

  function traceTimedSegment(pts, t0, t1, color) {
    if (t1 < 0 || t0 > 1) return;
    const start = clamp(t0, 0, 1);
    const end = clamp(t1, 0, 1);
    if (end <= start) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const pt = sampleTimedPath(pts, start + (end - start) * i / 32);
      if (!pt) continue;
      i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  function ellipsePoint(c, rx, ry, th) {
    const xr = rx * Math.cos(th);
    const yr = ry * Math.sin(th);
    return {
      x: c.x + xr * Math.cos(ORBIT_ROT) - yr * Math.sin(ORBIT_ROT),
      y: c.y + xr * Math.sin(ORBIT_ROT) + yr * Math.cos(ORBIT_ROT),
    };
  }

  function drawPlanetFrame(s) {
    clear("Planet-centered fly-by", "The spacecraft follows a hyperbola; v_inf changes direction but not magnitude.");
    const cx = cv.width * 0.48, cy = cv.height * 0.55;
    planet(cx, cy, 44, s.planet);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 95, 0, 7); ctx.stroke();

    const thetaInf = Math.acos(-1 / s.ecc);
    const localIncomingVelocity = Math.PI - s.sign * thetaInf;
    const rot = s.incomingAngle - localIncomingVelocity;
    const p = s.rp * (1 + s.ecc);
    const periPx = clamp(44 + 22 + s.alt / 2600, 66, 150);
    const sc = periPx / s.rp;
    const pts = [];
    const margin = 0.03;
    for (let i = 0; i <= 260; i++) {
      const nu = -thetaInf + margin + (2 * (thetaInf - margin)) * i / 260;
      const r = p / (1 + s.ecc * Math.cos(nu));
      if (!Number.isFinite(r) || r <= 0 || r * sc > 520) continue;
      const x = r * Math.cos(nu);
      const y = s.sign * r * Math.sin(nu);
      const xr = x * Math.cos(rot) - y * Math.sin(rot);
      const yr = x * Math.sin(rot) + y * Math.cos(rot);
      pts.push({ x: cx + xr * sc, y: cy - yr * sc, r });
    }

    const periA = rot;
    const peri = { x: cx + Math.cos(periA) * periPx, y: cy - Math.sin(periA) * periPx };
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(peri.x, peri.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#46c98b";
    ctx.beginPath(); ctx.arc(peri.x, peri.y, 4, 0, 7); ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    pts.forEach((pt, i) => { i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y); });
    ctx.stroke();

    if (pts.length > 18) {
      arrow(pts[0].x, pts[0].y, pts[12].x, pts[12].y, "#7fb3ff", "v_inf-");
      arrow(pts[pts.length - 13].x, pts[pts.length - 13].y, pts[pts.length - 1].x, pts[pts.length - 1].y, "#ffcc55", "v_inf+");
      const timedPts = buildTimedPath(pts, 1 / sc, s);
      const pathT = (clock * 0.08) % 1;
      traceTimedSegment(timedPts, pathT - 0.085, pathT, "rgba(255,255,255,.55)");
      const craft = sampleTimedPath(timedPts, pathT);
      if (craft) glow(craft.x, craft.y, 4.5, "#ffffff", "#ffffff");
    }

    ctx.strokeStyle = "#46c98b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, periPx + 28, -s.incomingAngle, -(s.incomingAngle + s.sign * s.delta), s.sign > 0);
    ctx.stroke();

    // const turnT = 0.15 + 0.7 * (0.5 + 0.5 * Math.sin(clock * 1.6));
    // const turnA = -s.incomingAngle - s.sign * s.delta * turnT;
    // glow(cx + Math.cos(turnA) * (periPx + 28), cy + Math.sin(turnA) * (periPx + 28), 3.5, "#46c98b", "#46c98b");

    ctx.fillStyle = "#46c98b";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("turning angle delta = " + deg(s.delta).toFixed(1) + " deg", 24, cv.height - 48);
    ctx.fillText("closest approach stays outside the planet: r_p = " + s.rp.toFixed(0) + " km", 24, cv.height - 28);
  }

  function vecPoint(origin, v, sc, t) {
    const f = t === undefined ? 1 : t;
    return { x: origin.x + v.x * sc * f, y: origin.y - v.y * sc * f };
  }

  function movingDot(origin, v, sc, phase, color) {
    const pt = vecPoint(origin, v, sc, 0.18 + 0.72 * phase);
    glow(pt.x, pt.y, 3.5, color, color);
  }

  function drawHelioFrame(s) {
    clear("Heliocentric energy exchange", "Adding planet velocity turns a direction change into a speed change.");
    const o1 = { x: cv.width * 0.28, y: cv.height * 0.58 };
    const o2 = { x: cv.width * 0.68, y: cv.height * 0.58 };
    const sc = 6.2;
    planet(o1.x, o1.y + 118, 18, s.planet);
    planet(o2.x, o2.y + 118, 18, s.planet);

    arrow(o1.x, o1.y, vecPoint(o1, s.vp, sc).x, vecPoint(o1, s.vp, sc).y, "#9aa7c2", "v_p");
    arrow(o1.x, o1.y, vecPoint(o1, s.vin, sc).x, vecPoint(o1, s.vin, sc).y, "#7fb3ff", "v_inf-");
    arrow(o1.x, o1.y, vecPoint(o1, s.before, sc).x, vecPoint(o1, s.before, sc).y, "#ffffff", "v_before");

    arrow(o2.x, o2.y, vecPoint(o2, s.vp, sc).x, vecPoint(o2, s.vp, sc).y, "#9aa7c2", "v_p");
    arrow(o2.x, o2.y, vecPoint(o2, s.vout, sc).x, vecPoint(o2, s.vout, sc).y, "#ffcc55", "v_inf+");
    arrow(o2.x, o2.y, vecPoint(o2, s.after, sc).x, vecPoint(o2, s.after, sc).y, "#46c98b", "v_after");

    const phaseA = (clock * 0.72) % 1;
    const phaseB = (clock * 0.72 + 0.35) % 1;
    movingDot(o1, s.before, sc, phaseA, "#ffffff");
    movingDot(o1, s.vin, sc, phaseB, "#7fb3ff");
    movingDot(o2, s.after, sc, phaseB, "#46c98b");
    movingDot(o2, s.vout, sc, phaseA, "#ffcc55");

    ctx.fillStyle = "#c8d2e8";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("Before encounter", o1.x - 58, o1.y - 152);
    ctx.fillText("After encounter", o2.x - 52, o2.y - 152);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("v_before = v_p + v_inf-", o1.x - 72, o1.y + 168);
    ctx.fillText("v_after = v_p + v_inf+", o2.x - 70, o2.y + 168);
  }

  function targetOrbitFor(planetKey) {
    if (planetKey === "jupiter") return { rx: 210, ry: 122, color: "#ffcc55" };
    if (planetKey === "mars") return { rx: 272, ry: 158, color: "#ff9d6e" };
    return { rx: 260, ry: 148, color: "#e0673a" };
  }

  function arcPath(a, b, col, label, bend) {
    const mx = (a.x + b.x) / 2;
    const my = Math.min(a.y, b.y) - bend;
    const pts = [];
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;
      pts.push({ x, y });
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    arrow(mx - 12, my + 4, mx + 14, my - 4, col, label);
    return pts;
  }

  function drawOrbit(c, rx, ry, col) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, ORBIT_ROT, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawChain(s) {
    clear("Lambert transfer + fly-by", "A fly-by inserts a turning node between two heliocentric arcs.");
    const sun = { x: cv.width * 0.5, y: cv.height * 0.58 };
    ctx.fillStyle = "#ffcc55";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 18, 0, 7); ctx.fill();
    ctx.fillStyle = "#c8d2e8";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("Sun", sun.x - 10, sun.y + 38);

    const earthOrbit = PLANETS.earth.orbit;
    const assistOrbit = s.planet.orbit;
    const targetOrbit = targetOrbitFor(planetSel.value);
    drawOrbit(sun, earthOrbit.rx, earthOrbit.ry, "#3a7bd5");
    drawOrbit(sun, assistOrbit.rx, assistOrbit.ry, s.planet.color);
    drawOrbit(sun, targetOrbit.rx, targetOrbit.ry, targetOrbit.color);

    const earth = ellipsePoint(sun, earthOrbit.rx, earthOrbit.ry, 2.85);
    const assist = ellipsePoint(sun, assistOrbit.rx, assistOrbit.ry, 5.02);
    const target = ellipsePoint(sun, targetOrbit.rx, targetOrbit.ry, 0.58);
    planet(earth.x, earth.y, 13, PLANETS.earth, "Earth");
    planet(assist.x, assist.y, 16, s.planet, s.planet.label + " fly-by");
    planet(target.x, target.y, 12, { color: targetOrbit.color, label: "Target" }, "Target");

    const arc1 = arcPath(earth, assist, "#7fb3ff", "Lambert arc 1", 74);
    const arc2 = arcPath(assist, target, "#ffcc55", "Lambert arc 2", 60);
    arrow(assist.x - 78, assist.y + 42, assist.x - 18, assist.y + 14, "#7fb3ff", "v_inf-");
    arrow(assist.x + 18, assist.y - 14, assist.x + 82, assist.y - 48, "#ffcc55", "v_inf+");

    const phase = (clock * 0.1) % 1;
    let craft;
    if (phase < 0.45) craft = samplePath(arc1, phase / 0.45);
    else if (phase < 0.55) craft = assist;
    else craft = samplePath(arc2, (phase - 0.55) / 0.45);
    if (phase < 0.45) traceSegment(arc1, Math.max(0, phase / 0.45 - 0.14), phase / 0.45, "rgba(127,179,255,.55)");
    if (phase > 0.55) traceSegment(arc2, Math.max(0, (phase - 0.55) / 0.45 - 0.14), (phase - 0.55) / 0.45, "rgba(255,204,85,.55)");
    if (craft) glow(craft.x, craft.y, 4.5, "#ffffff", "#ffffff");

    ctx.fillStyle = "#46c98b";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("The fly-by supplies an effective heliocentric speed change of " + (vlen(s.after) - vlen(s.before)).toFixed(2) + " km/s", 24, cv.height - 32);
  }

  function render() {
    if (!ready) return;
    const s = state();
    setReadouts(s);
    if (viewSel.value === "helio") drawHelioFrame(s);
    else if (viewSel.value === "chain") drawChain(s);
    else drawPlanetFrame(s);
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    clock += dt;
    render();
    raf = requestAnimationFrame(loop);
  }

  function bindInput(el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  }

  global.ModFlyby = {
    init() {
      cv = byId("flyCanvas");
      if (!cv) return;
      ctx = cv.getContext("2d");
      viewSel = byId("flyView");
      planetSel = byId("flyPlanet");
      vinfSlider = byId("flyVinf");
      altSlider = byId("flyAlt");
      angleSlider = byId("flyAngle");
      turnSel = byId("flyTurn");
      [viewSel, planetSel, vinfSlider, altSlider, angleSlider, turnSel].forEach(bindInput);
      ready = true;
    },
    onShow() {
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    onHide() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    },
    setLang() { render(); },
  };
})(window);
