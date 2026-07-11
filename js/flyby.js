/* Two-body fly-by visualisation for the Q4 reference model. */
(function (global) {
  "use strict";

  const PLANETS = {
    venus: { mu: 324858.592, radius: 6051.8, speed: 35.02, color: "#e0b36d" },
    mars: { mu: 42828.375214, radius: 3396.19, speed: 24.13, color: "#ef7858" },
    jupiter: { mu: 126712764.1, radius: 71492.0, speed: 13.07, color: "#d99d68" },
  };
  const ALTITUDE_MIN = 100;
  const ALTITUDE_MAX = 10000000;
  const FALLBACK = {
    fly_explain_planet: "Planet-centred, two-body hyperbola. Historical presets reproduce only the supplied encounter scalars, not a complete navigation reconstruction.",
    fly_explain_helio: "Ideal planar vector addition. Adjust the incoming direction to see why heliocentric speed can rise or fall while |v∞| is conserved in the planet frame.",
    fly_cap_planet: "Physical distances are plotted on one common km scale; the planet disc and periapsis are not visually exaggerated.",
    fly_cap_helio: "All arrows share one km/s scale. The displayed heliocentric speed change depends on the chosen incoming direction.",
    fly_no_events: "No supplied historical event is available for Mars. Use free parameters instead.",
    fly_event_note: "Preset scalars from the supplied historical-event table. Source",
    fly_planet_frame_title: "fly-by geometry",
    fly_helio_title: "Heliocentric velocity vectors",
    fly_scale: "scale",
    fly_km: "km",
    fly_speed: "km/s",
    fly_before_label: "before",
    fly_after_label: "after",
    fly_planet_velocity: "planet velocity",
    fly_vinf_in: "incoming v∞",
    fly_vinf_out: "outgoing v∞",
    fly_turning: "turning angle",
  };

  let cv, ctx, viewSel, planetSel, modeSel, eventSel, vinfSlider, altSlider, angleSlider, turnSel;
  let ready = false;

  function byId(id) { return document.getElementById(id); }
  function rad(value) { return value * Math.PI / 180; }
  function deg(value) { return value * 180 / Math.PI; }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function len(v) { return Math.hypot(v.x, v.y); }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function fromAngle(angle, magnitude) { return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude }; }
  function i18n(key) {
    const value = global.I18N && global.I18N.t ? global.I18N.t(key) : key;
    return value === key ? (FALLBACK[key] || key) : value;
  }
  function planetName() { return i18n(`fly_planet_${planetSel.value}`); }
  function number(value, digits) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }); }

  function altitudeFromSlider() {
    const fraction = Number(altSlider.value) / Number(altSlider.max);
    return ALTITUDE_MIN * Math.pow(ALTITUDE_MAX / ALTITUDE_MIN, fraction);
  }

  function setAltitude(altitude) {
    const bounded = clamp(Number(altitude), ALTITUDE_MIN, ALTITUDE_MAX);
    const fraction = Math.log(bounded / ALTITUDE_MIN) / Math.log(ALTITUDE_MAX / ALTITUDE_MIN);
    altSlider.value = String(fraction * Number(altSlider.max));
  }

  function selectedEvent() {
    const events = global.FLYBY_EVENTS || [];
    return events.find(event => event.id === eventSel.value) || null;
  }

  function state() {
    const planet = PLANETS[planetSel.value] || PLANETS.jupiter;
    const vinf = Number(vinfSlider.value);
    const altitude = altitudeFromSlider();
    const rp = planet.radius + altitude;
    const ah = -planet.mu / (vinf * vinf);
    const ecc = 1 + rp * vinf * vinf / planet.mu;
    const delta = 2 * Math.asin(clamp(1 / ecc, -1, 1));
    const vectorDv = 2 * vinf * Math.sin(delta / 2);
    const incomingAngle = rad(Number(angleSlider.value));
    const sign = Number(turnSel.value);
    const vin = fromAngle(incomingAngle, vinf);
    const vout = fromAngle(incomingAngle + sign * delta, vinf);
    const vp = { x: planet.speed, y: 0 };
    const before = add(vp, vin);
    const after = add(vp, vout);
    return { planet, vinf, altitude, rp, ah, ecc, delta, vectorDv, incomingAngle, sign, vin, vout, vp, before, after };
  }

  function fillBackground(title, subtitle) {
    ctx.fillStyle = "#070b15";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#e8edf7";
    ctx.font = "700 18px Segoe UI, sans-serif";
    ctx.fillText(title, 24, 34);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(subtitle, 24, 55);
  }

  function line(x1, y1, x2, y2, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  function arrow(x1, y1, x2, y2, color, label) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(angle - 0.45), y2 - 10 * Math.sin(angle - 0.45));
    ctx.lineTo(x2 - 10 * Math.cos(angle + 0.45), y2 - 10 * Math.sin(angle + 0.45));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(label, x2 + 8, y2 - 8);
    }
    ctx.restore();
  }

  function drawPlanetFrame(s) {
    fillBackground(`${planetName()} ${i18n("fly_planet_frame_title")}`, i18n("fly_cap_planet"));
    const plot = { left: 66, right: cv.width - 34, top: 84, bottom: cv.height - 72 };
    const cx = (plot.left + plot.right) / 2;
    const cy = (plot.top + plot.bottom) / 2;
    const rMax = Math.max(s.rp * 7.4, s.planet.radius * 2.4);
    const scale = Math.min((plot.right - plot.left) / (2 * rMax), (plot.bottom - plot.top) / (2 * rMax));
    const toCanvas = (x, y) => ({ x: cx + x * scale, y: cy - y * scale });

    line(plot.left, cy, plot.right, cy, "rgba(154,167,194,.2)", 1);
    line(cx, plot.top, cx, plot.bottom, "rgba(154,167,194,.2)", 1);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.fillText(i18n("fly_legend"), plot.left, 75);
    ctx.fillText(`1 px = ${number(1 / scale, 0)} ${i18n("fly_km")}`, plot.left, cv.height - 34);

    const thetaInf = Math.acos(-1 / s.ecc);
    const p = s.rp * (1 + s.ecc);
    const endpoint = rMax * 1.18;
    [-thetaInf, thetaInf].forEach(theta => {
      const q = toCanvas(endpoint * Math.cos(theta), endpoint * Math.sin(theta));
      line(cx, cy, q.x, q.y, "rgba(154,167,194,.55)", 1, [6, 5]);
    });

    const points = [];
    const margin = 0.018;
    for (let index = 0; index <= 480; index++) {
      const theta = -thetaInf + margin + (2 * (thetaInf - margin) * index / 480);
      const radius = p / (1 + s.ecc * Math.cos(theta));
      if (!Number.isFinite(radius) || radius > rMax * 1.15) continue;
      points.push(toCanvas(radius * Math.cos(theta), radius * Math.sin(theta)));
    }
    ctx.strokeStyle = "#7fb3ff";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();

    const planetRadius = s.planet.radius * scale;
    const g = ctx.createRadialGradient(cx - planetRadius * 0.3, cy - planetRadius * 0.3, 1, cx, cy, Math.max(planetRadius, 1));
    g.addColorStop(0, "#fff5d4");
    g.addColorStop(0.35, s.planet.color);
    g.addColorStop(1, "#51352e");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2); ctx.fill();

    const peri = toCanvas(s.rp, 0);
    ctx.fillStyle = "#ffcc55";
    ctx.beginPath(); ctx.arc(peri.x, peri.y, 4, 0, Math.PI * 2); ctx.fill();
    line(cx, cy, peri.x, peri.y, "rgba(154,167,194,.55)", 1, [4, 4]);
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("rₚ", (cx + peri.x) / 2, cy - 8);

    if (points.length > 28) {
      arrow(points[7].x, points[7].y, points[24].x, points[24].y, "#7fb3ff", "v∞−");
      arrow(points[points.length - 25].x, points[points.length - 25].y, points[points.length - 8].x, points[points.length - 8].y, "#ffcc55", "v∞+");
    }
    const velocityOrigin = { x: plot.left + 118, y: plot.top + 110 };
    const incomingDirection = Math.PI - thetaInf;
    const outgoingDirection = thetaInf;
    const velocityLength = 64;
    const velocityEnd = angle => ({
      x: velocityOrigin.x + velocityLength * Math.cos(angle),
      y: velocityOrigin.y - velocityLength * Math.sin(angle),
    });
    const incomingEnd = velocityEnd(incomingDirection);
    const outgoingEnd = velocityEnd(outgoingDirection);
    arrow(velocityOrigin.x, velocityOrigin.y, incomingEnd.x, incomingEnd.y, "#7fb3ff", "v∞−");
    arrow(velocityOrigin.x, velocityOrigin.y, outgoingEnd.x, outgoingEnd.y, "#ffcc55", "v∞+");

    const arcRadius = 38;
    ctx.strokeStyle = "#46c98b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let index = 0; index <= 32; index++) {
      const angle = incomingDirection + (outgoingDirection - incomingDirection) * index / 32;
      const x = velocityOrigin.x + arcRadius * Math.cos(angle);
      const y = velocityOrigin.y - arcRadius * Math.sin(angle);
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#46c98b";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(`δ = ${deg(s.delta).toFixed(1)}°`, velocityOrigin.x + arcRadius + 12, velocityOrigin.y - 18);
  }

  function vectorPoint(origin, vector, scale) { return { x: origin.x + vector.x * scale, y: origin.y - vector.y * scale }; }

  function drawHelioFrame(s) {
    fillBackground(`${planetName()} ${i18n("fly_helio_title")}`, i18n("fly_cap_helio"));
    const origin = { x: cv.width * 0.48, y: cv.height * 0.58 };
    const maxSpeed = Math.max(1, len(s.before), len(s.after), s.planet.speed + s.vinf);
    const scale = Math.min(8.5, 240 / maxSpeed);
    const drawVector = (vector, color, label) => {
      const end = vectorPoint(origin, vector, scale);
      arrow(origin.x, origin.y, end.x, end.y, color, label);
    };
    drawVector(s.vp, "#9aa7c2", "vₚ");
    drawVector(s.vin, "#7fb3ff", "v∞−");
    drawVector(s.vout, "#ffcc55", "v∞+");
    drawVector(s.before, "#e8edf7", "vbefore");
    drawVector(s.after, "#46c98b", "vafter");
    ctx.fillStyle = "#9aa7c2";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(`${i18n("fly_scale")}: 1 ${i18n("fly_speed")} = ${number(scale, 1)} px`, 24, cv.height - 34);
  }

  function updateReadouts(s) {
    byId("flyVinfv").textContent = s.vinf.toFixed(1);
    byId("flyAltv").textContent = number(s.altitude, 0);
    byId("flyAnglev").textContent = String(Math.round(deg(s.incomingAngle)));
    byId("flyRp").textContent = `${number(s.rp, 0)} km`;
    byId("flyA").textContent = `${number(s.ah, 0)} km`;
    byId("flyEcc").textContent = s.ecc.toFixed(3);
    byId("flyDelta").textContent = `${deg(s.delta).toFixed(1)}°`;
    byId("flyVectorDv").textContent = `${s.vectorDv.toFixed(2)} km/s`;
    byId("flyBefore").textContent = `${len(s.before).toFixed(2)} km/s`;
    byId("flyAfter").textContent = `${len(s.after).toFixed(2)} km/s`;
    const gain = len(s.after) - len(s.before);
    const gainCell = byId("flyGain");
    gainCell.textContent = `${gain >= 0 ? "+" : ""}${gain.toFixed(2)} km/s`;
    gainCell.style.color = gain >= 0 ? "#46c98b" : "#ff9d6e";
  }

  function updateEventOptions() {
    const events = (global.FLYBY_EVENTS || []).filter(event => event.planet === planetSel.value);
    eventSel.replaceChildren();
    events.forEach(event => {
      const option = document.createElement("option");
      option.value = event.id;
      option.textContent = `${event.mission} - ${event.date}`;
      eventSel.appendChild(option);
    });
    eventSel.disabled = !events.length;
  }

  function applyEvent() {
    const event = selectedEvent();
    if (!event) return;
    vinfSlider.value = String(event.vinf);
    setAltitude(event.altitude);
  }

  function updateModeUi() {
    const planetView = viewSel.value === "planet";
    document.querySelectorAll(".fly-planet-only").forEach(element => element.hidden = !planetView);
    document.querySelectorAll(".fly-helio-only").forEach(element => element.hidden = planetView);
    const history = planetView && modeSel.value === "history";
    const hasEvents = eventSel.options.length > 0;
    const status = byId("flyEventStatus");
    byId("flyEventRow").hidden = !history;
    status.hidden = !history;
    eventSel.disabled = !history || !hasEvents;
    vinfSlider.disabled = history && hasEvents;
    altSlider.disabled = history && hasEvents;
    const event = selectedEvent();
    if (!planetView || !history) status.textContent = "";
    else if (history && !event) status.textContent = i18n("fly_no_events");
    else if (history && event) {
      status.innerHTML = `${i18n("fly_event_note")}: <a href="${event.source}" target="_blank" rel="noreferrer">${event.source}</a>`;
    }
    byId("flyExplain").textContent = i18n(planetView ? "fly_explain_planet" : "fly_explain_helio");
    byId("flyCap").textContent = i18n(planetView ? "fly_cap_planet" : "fly_cap_helio");
  }

  function render() {
    if (!ready) return;
    updateModeUi();
    const s = state();
    updateReadouts(s);
    if (viewSel.value === "helio") drawHelioFrame(s);
    else drawPlanetFrame(s);
  }

  function bindInput(element, handler) {
    element.addEventListener("input", handler || render);
    element.addEventListener("change", handler || render);
  }

  global.ModFlyby = {
    init() {
      cv = byId("flyCanvas");
      if (!cv) return;
      ctx = cv.getContext("2d");
      viewSel = byId("flyView");
      planetSel = byId("flyPlanet");
      modeSel = byId("flyMode");
      eventSel = byId("flyEvent");
      vinfSlider = byId("flyVinf");
      altSlider = byId("flyAlt");
      angleSlider = byId("flyAngle");
      turnSel = byId("flyTurn");
      setAltitude(280000);
      updateEventOptions();
      bindInput(viewSel, () => {
        if (viewSel.value === "helio") modeSel.value = "free";
        render();
      });
      bindInput(planetSel, () => {
        updateEventOptions();
        if (modeSel.value === "history") applyEvent();
        render();
      });
      bindInput(modeSel, () => {
        if (modeSel.value === "history") applyEvent();
        render();
      });
      bindInput(eventSel, () => { applyEvent(); render(); });
      [vinfSlider, altSlider, angleSlider, turnSel].forEach(element => bindInput(element));
      ready = true;
    },
    onShow() { render(); },
    onHide() {},
    setLang() { render(); },
  };
})(window);
