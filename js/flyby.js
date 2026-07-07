/* Fly-by / slingshot teaching module for part iv. */
(function (global) {
  "use strict";

  const PLANETS = {
    venus: { label: "Venus", mu: 324858.592, radius: 6051.8, speed: 35.02, color: "#d8b06a" },
    earth: { label: "Earth", mu: 398600.435, radius: 6378.1, speed: 29.78, color: "#3a7bd5" },
    mars: { label: "Mars", mu: 42828.374, radius: 3396.2, speed: 24.13, color: "#e0673a" },
    jupiter: { label: "Jupiter", mu: 126686534.0, radius: 71492.0, speed: 13.07, color: "#d9a066" },
  };

  let cv, ctx, viewSel, planetSel, vinfSlider, altSlider, angleSlider, turnSel;
  let ready = false;

  function byId(id) { return document.getElementById(id); }
  function deg(rad) { return rad * 180 / Math.PI; }
  function rad(degValue) { return degValue * Math.PI / 180; }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function vlen(v) { return Math.hypot(v.x, v.y); }
  function fromAngle(angle, mag) { return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag }; }

  function state() {
    const planet = PLANETS[planetSel.value] || PLANETS.earth;
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

  function drawStars() {
    ctx.fillStyle = "rgba(255,255,255,.45)";
    for (let i = 0; i < 70; i++) {
      const x = (i * 113) % cv.width;
      const y = (i * 67) % cv.height;
      const r = i % 9 === 0 ? 1.3 : 0.7;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
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

  function planet(cx, cy, r, p) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.2, p.color);
    g.addColorStop(1, "#1b2133");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.2)";
    ctx.stroke();
    ctx.fillStyle = "#c8d2e8";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(p.label, cx - ctx.measureText(p.label).width / 2, cy + r + 20);
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
      pts.push({ x: cx + xr * sc, y: cy - yr * sc });
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
    }

    ctx.strokeStyle = "#46c98b";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, periPx + 28, -s.incomingAngle, -(s.incomingAngle + s.sign * s.delta), s.sign > 0); ctx.stroke();
    ctx.fillStyle = "#46c98b";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("turning angle delta = " + deg(s.delta).toFixed(1) + " deg", 24, cv.height - 48);
    ctx.fillText("closest approach stays outside the planet: r_p = " + s.rp.toFixed(0) + " km", 24, cv.height - 28);
  }

  function vecPoint(origin, v, sc) { return { x: origin.x + v.x * sc, y: origin.y - v.y * sc }; }

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

    ctx.fillStyle = "#c8d2e8";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("Before encounter", o1.x - 58, o1.y - 152);
    ctx.fillText("After encounter", o2.x - 52, o2.y - 152);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("v_before = v_p + v_inf-", o1.x - 72, o1.y + 168);
    ctx.fillText("v_after = v_p + v_inf+", o2.x - 70, o2.y + 168);
  }

  function drawChain(s) {
    clear("Lambert transfer + fly-by", "A fly-by can connect Lambert arcs by rotating excess velocity at the intermediate planet.");
    const sun = { x: cv.width * 0.5, y: cv.height * 0.58 };
    ctx.fillStyle = "#ffcc55";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 18, 0, 7); ctx.fill();
    ctx.fillStyle = "#c8d2e8";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("Sun", sun.x - 10, sun.y + 38);

    drawOrbit(sun, 120, 70, "#3a7bd5");
    drawOrbit(sun, 185, 108, s.planet.color);
    drawOrbit(sun, 260, 148, "#e0673a");
    const earth = { x: sun.x - 116, y: sun.y + 17 };
    const assist = { x: sun.x + 28, y: sun.y - 105 };
    const mars = { x: sun.x + 245, y: sun.y + 45 };
    planet(earth.x, earth.y, 13, PLANETS.earth);
    planet(assist.x, assist.y, 16, s.planet);
    planet(mars.x, mars.y, 12, PLANETS.mars);
    arcPath(earth, assist, "#7fb3ff", "Lambert arc 1");
    arcPath(assist, mars, "#ffcc55", "Lambert arc 2");
    arrow(assist.x - 78, assist.y + 42, assist.x - 18, assist.y + 14, "#7fb3ff", "v_inf-");
    arrow(assist.x + 18, assist.y - 14, assist.x + 82, assist.y - 48, "#ffcc55", "v_inf+");
    ctx.fillStyle = "#46c98b";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("The fly-by supplies an effective heliocentric speed change of " + (vlen(s.after) - vlen(s.before)).toFixed(2) + " km/s", 24, cv.height - 32);
  }

  function drawOrbit(c, rx, ry, col) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, -0.08, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function arcPath(a, b, col, label) {
    const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 78;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    arrow(mx - 12, my + 4, mx + 14, my - 4, col, label);
  }

  function render() {
    if (!ready) return;
    const s = state();
    setReadouts(s);
    if (viewSel.value === "helio") drawHelioFrame(s);
    else if (viewSel.value === "chain") drawChain(s);
    else drawPlanetFrame(s);
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
      viewSel = byId("flyView"); planetSel = byId("flyPlanet");
      vinfSlider = byId("flyVinf"); altSlider = byId("flyAlt");
      angleSlider = byId("flyAngle"); turnSel = byId("flyTurn");
      [viewSel, planetSel, vinfSlider, altSlider, angleSlider, turnSel].forEach(bindInput);
      ready = true;
    },
    onShow() { render(); },
    onHide() {},
    setLang() { render(); },
  };
})(window);
