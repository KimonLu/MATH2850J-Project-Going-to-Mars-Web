/* 3-D DE440s Lambert transfer viewer. */
(function (global) {
  "use strict";

  const A = global.Astro;
  const SITE = global.MarsDE440sData;
  const SC = 5 / A.AU;
  let box, renderer, scene, camera, raf = null, ready = false;
  let sun, earth, mars, craft, transferLine, earthOrbit, marsOrbit;
  let winSel, depSlider, tofSlider;
  let winIdx = 0, baseJD = A.jdFromIso(SITE.windows[0].departureStart);
  let depOff = 123.25, tof = 310.25, playing = true, speed = 1.0;
  let cam = { theta: 0.9, phi: 0.62, r: 24 }, topView = false;
  let clockDays = 0, craftEl = null, craftM0 = 0, craftDM = 0;

  function lang() { return global.I18N && global.I18N.getLang ? global.I18N.getLang() : 0; }
  function text(key) { return global.I18N ? global.I18N.t(key) : key; }
  const V3 = p => new THREE.Vector3(p[0] * SC, p[2] * SC, -p[1] * SC);

  function dateOffset(startIso, whenIso) {
    return A.jdFromIso(whenIso) - A.jdFromIso(startIso);
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

  function metricAt(dep, tofDays) {
    const rE = A.planetState("earth", dep);
    const rM = A.planetState("mars", dep + tofDays);
    const tr = A.lambert(rE.r, rM.r, tofDays * A.DAY, A.MU_SUN, true);
    if (!tr) return null;
    const vinfE = A.norm(A.sub(tr.v1, rE.v));
    const vinfM = A.norm(A.sub(tr.v2, rM.v));
    const leo = A.patchedConicDv(vinfE, A.MU_EARTH, A.R_EARTH, 200000);
    const lmo = A.patchedConicDv(vinfM, A.MU_MARS, A.R_MARS, 250000);
    return { rE, rM, tr, vinfE, vinfM, c3: (vinfE / 1000) ** 2, totalDv: (leo + lmo) / 1000 };
  }

  function makeOrbitLine(name, jd0, per, col) {
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(V3(A.planetState(name, jd0 + per * k / 256).r));
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: col })
    );
  }

  function refreshOrbitLine(line, name, jd0, per) {
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(V3(A.planetState(name, jd0 + per * k / 256).r));
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  function buildTransfer() {
    const dep = baseJD + depOff;
    const result = metricAt(dep, tof);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("tDepDate", A.jdToIso(dep));
    set("tArrDate", A.jdToIso(dep + tof));
    set("tDepv", depOff.toFixed(depOff % 1 ? 2 : 0));
    set("tTofv", tof.toFixed(tof % 1 ? 2 : 0));
    if (!result) {
      craftEl = null;
      set("tC3", "-"); set("tTotalDv", "-"); set("tInc", "-");
      return;
    }
    const el = stateToElem(result.rE.r, result.tr.v1);
    const endEl = stateToElem(result.rM.r, result.tr.v2);
    let nu0 = el.nu, nu1 = endEl.nu;
    if (nu1 < nu0) nu1 += 2 * Math.PI;
    const pts = [];
    for (let k = 0; k <= 240; k++) {
      const st = A.elementsToState(el.a, el.e, el.inc, el.Om, el.om, nu0 + (nu1 - nu0) * k / 240);
      pts.push(V3(st.r));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    if (transferLine) { transferLine.geometry.dispose(); transferLine.geometry = g; }

    craftEl = el;
    const E0 = 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(el.nu / 2), Math.sqrt(1 + el.e) * Math.cos(el.nu / 2));
    craftM0 = E0 - el.e * Math.sin(E0);
    craftDM = Math.sqrt(A.MU_SUN / Math.pow(el.a, 3)) * tof * A.DAY;
    set("tC3", result.c3.toFixed(2) + " km²/s²");
    set("tTotalDv", result.totalDv.toFixed(3) + " km/s");
    set("tInc", (el.inc * 180 / Math.PI).toFixed(2) + "°");
    clockDays = 0;
  }

  function setWindow(index, useBest) {
    winIdx = index;
    const w = SITE.windows[winIdx];
    baseJD = A.jdFromIso(w.departureStart);
    depSlider.max = Math.round(A.jdFromIso(w.departureEnd) - baseJD);
    depSlider.step = "0.25";
    tofSlider.min = w.tofStartDays;
    tofSlider.max = w.tofEndDays;
    tofSlider.step = "0.25";
    if (useBest) {
      const best = w.candidates.minimum_total_dv;
      depOff = dateOffset(w.departureStart, best.departure_datetime_utc);
      tof = +best.tof_days;
    }
    depSlider.value = String(depOff);
    tofSlider.value = String(tof);
    if (ready) {
      refreshOrbitLine(earthOrbit, "earth", baseJD, 365.25);
      refreshOrbitLine(marsOrbit, "mars", baseJD, 687);
      buildTransfer();
    }
  }

  function setExplain() {
    const el = document.getElementById("tExplain");
    if (!el) return;
    const zh = "三维视图使用 DE440s 行星状态作为地球出发和火星到达边界条件；白色弧线为对应的零圈顺行 Lambert 转移。切换窗口时，滑块的日期范围随该窗口更新，默认定位到该窗口的最小总 Δv 方案。";
    const en = "The 3-D view uses DE440s planetary states as the Earth departure and Mars arrival boundary conditions; the white arc is the matching zero-revolution prograde Lambert transfer. Changing the window updates the slider date range and defaults to that window's minimum-total-Δv design.";
    el.textContent = lang() ? en : zh;
  }

  function fillWindowSelector() {
    if (!winSel) return;
    const current = winSel.value || "0";
    winSel.innerHTML = "";
    SITE.windows.forEach((w, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = lang() ? w.labelEn : w.labelZh;
      winSel.appendChild(o);
    });
    winSel.value = current;
  }

  function setup() {
    box = document.getElementById("threeBox");
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(box.clientWidth, box.clientHeight);
    renderer.setClearColor(0x070b15, 1);
    box.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, box.clientWidth / box.clientHeight, 0.1, 1000);
    scene.add(new THREE.AmbientLight(0x666677));
    scene.add(new THREE.PointLight(0xffffff, 1.4));
    sun = mesh(0.7, 0xffcc55, true); scene.add(sun);
    earth = mesh(0.28, 0x3a7bd5); scene.add(earth);
    mars = mesh(0.22, 0xe0673a); scene.add(mars);
    craft = mesh(0.12, 0xffffff, true); scene.add(craft);
    earthOrbit = makeOrbitLine("earth", baseJD, 365.25, 0x3a7bd5); scene.add(earthOrbit);
    marsOrbit = makeOrbitLine("mars", baseJD, 687, 0xe0673a); scene.add(marsOrbit);
    transferLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(transferLine);
    scene.add(new THREE.GridHelper(20, 20, 0x223052, 0x16203a));
    addControls();
    ready = true;
    buildTransfer();
  }

  function mesh(r, col, emissive) {
    const mat = emissive ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshStandardMaterial({ color: col });
    return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), mat);
  }

  function addControls() {
    const el = renderer.domElement;
    let drag = false, px = 0, py = 0;
    el.addEventListener("mousedown", e => { drag = true; px = e.clientX; py = e.clientY; });
    window.addEventListener("mouseup", () => drag = false);
    window.addEventListener("mousemove", e => {
      if (!drag) return;
      cam.theta -= (e.clientX - px) * 0.01;
      cam.phi -= (e.clientY - py) * 0.01;
      cam.phi = Math.max(0.05, Math.min(Math.PI - 0.05, cam.phi));
      px = e.clientX; py = e.clientY;
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      cam.r *= (1 + Math.sign(e.deltaY) * 0.08);
      cam.r = Math.max(8, Math.min(60, cam.r));
    }, { passive: false });
  }

  function updateCam() {
    if (topView) camera.position.set(0, cam.r, 0.001);
    else camera.position.set(cam.r * Math.sin(cam.phi) * Math.cos(cam.theta), cam.r * Math.cos(cam.phi), cam.r * Math.sin(cam.phi) * Math.sin(cam.theta));
    camera.lookAt(0, 0, 0);
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    const hold = 40;
    if (playing) {
      clockDays += dt * speed * 30;
      if (clockDays > tof + hold) clockDays = 0;
    }
    const dep = baseJD + depOff;
    const nowJD = dep + Math.min(clockDays, tof);
    earth.position.copy(V3(A.planetState("earth", nowJD).r));
    mars.position.copy(V3(A.planetState("mars", nowJD).r));
    if (craftEl) {
      const s = Math.min(clockDays / tof, 1);
      const Mt = craftM0 + craftDM * s;
      const E = A.solveKepler(Mt, craftEl.e);
      const nu = A.trueFromEcc(E, craftEl.e);
      const st = A.elementsToState(craftEl.a, craftEl.e, craftEl.inc, craftEl.Om, craftEl.om, nu);
      craft.position.copy(V3(st.r));
      craft.visible = clockDays <= tof + 0.5;
    }
    updateCam();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  function bind(id, fn) {
    const e = document.getElementById(id);
    e.addEventListener("input", () => fn(e.value));
    return e;
  }

  const M = {
    init() {
      winSel = document.getElementById("tWindow");
      depSlider = bind("tDep", v => { depOff = +v; buildTransfer(); });
      tofSlider = bind("tTof", v => { tof = +v; buildTransfer(); });
      bind("tSpeed", v => { speed = +v; });
      fillWindowSelector();
      winSel.value = "0";
      winSel.onchange = () => setWindow(+winSel.value, true);
      document.getElementById("tPlay").onclick = function () {
        playing = !playing;
        this.textContent = playing ? text("play") : text("paused");
      };
      document.getElementById("tView").onclick = () => { topView = !topView; };
      document.getElementById("tBest").onclick = () => setWindow(winIdx, true);
      setWindow(0, true);
      setExplain();
    },
    onShow() {
      setExplain();
      if (!ready) {
        if (typeof THREE === "undefined") {
          document.getElementById("threeBox").innerHTML = "<p style='color:#9aa7c2;padding:20px'>three.js failed to load.</p>";
          return;
        }
        setup();
      } else {
        renderer.setSize(box.clientWidth, box.clientHeight);
        camera.aspect = box.clientWidth / box.clientHeight;
        camera.updateProjectionMatrix();
      }
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    onHide() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    },
    setLang() {
      fillWindowSelector();
      setExplain();
      buildTransfer();
    },
  };

  global.ModThree = M;
})(window);
