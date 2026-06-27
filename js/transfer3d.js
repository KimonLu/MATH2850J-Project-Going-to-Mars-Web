/* Module 3: 3-D real transfer -- Earth, Mars and spacecraft all move in
 * real (ephemeris) time, just like the Hohmann animation. three.js. */
(function (global) {
  "use strict";
  const A = global.Astro;
  const SC = 5 / A.AU;                       // scene units per metre
  let box, renderer, scene, camera, raf = null, ready = false;
  let sun, earth, mars, craft, transferLine, earthOrbit, marsOrbit;
  let depOff = 120, tof = 259, playing = true, speed = 1.0;
  let cam = { theta: 0.9, phi: 0.62, r: 24 }, topView = false;
  const baseJD = A.julianDate(2026, 1, 1);
  let arcPts = [], clockDays = 0;             // 0..tof+hold, sim days since departure
  let craftEl = null, craftM0 = 0, craftDM = 0;   // Kepler timing of the spacecraft

  function jdToDate(jd) {
    jd += 0.5; let Z = Math.floor(jd), F = jd - Z, Aa;
    if (Z < 2299161) Aa = Z; else { const al = Math.floor((Z - 1867216.25) / 36524.25); Aa = Z + 1 + al - Math.floor(al / 4); }
    const B = Aa + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + F, month = E < 14 ? E - 1 : E - 13, yr = month > 2 ? C - 4716 : C - 4715;
    const p = n => (n < 10 ? "0" : "") + n;
    return yr + "-" + p(month) + "-" + p(Math.floor(day));
  }

  function stateToElem(r, v) {
    const mu = A.MU_SUN, R = A.norm(r), V = A.norm(v);
    const h = A.cross(r, v), Hn = A.norm(h);
    const evec = A.sub(A.scale(A.cross(v, h), 1 / mu), A.scale(r, 1 / R));
    const e = A.norm(evec), a = -mu / (2 * (V * V / 2 - mu / R));
    const inc = Math.acos(h[2] / Hn);
    const n = [-h[1], h[0], 0], N = Math.hypot(n[0], n[1]);
    let Om = N > 1e-12 ? Math.atan2(n[1], n[0]) : 0;
    let om = (N > 1e-12 && e > 1e-12) ? Math.acos(Math.max(-1, Math.min(1, (n[0]*evec[0]+n[1]*evec[1]) / (N*e)))) : 0;
    if (evec[2] < 0) om = 2 * Math.PI - om;
    let nu = Math.acos(Math.max(-1, Math.min(1, A.dot(evec, r) / (e * R))));
    if (A.dot(r, v) < 0) nu = 2 * Math.PI - nu;
    return { a, e, inc, Om, om, nu };
  }
  const V3 = p => new THREE.Vector3(p[0] * SC, p[2] * SC, -p[1] * SC);  // ecliptic->scene (y up)

  function orbitLine(name, jd0, per, col) {
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(V3(A.planetState(name, jd0 + per * k / 256).r));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: col }));
  }

  function buildTransfer() {
    const dep = baseJD + depOff, arr = dep + tof;
    const rE = A.planetState("earth", dep), rM = A.planetState("mars", arr);
    const tr = A.lambert(rE.r, rM.r, tof * A.DAY, A.MU_SUN, true);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    arcPts = [];
    if (tr) {
      const el = stateToElem(rE.r, tr.v1), el2 = stateToElem(rM.r, tr.v2);
      let nu0 = el.nu, nu1 = el2.nu; if (nu1 < nu0) nu1 += 2 * Math.PI;
      const pts = [];
      for (let k = 0; k <= 220; k++) {
        const nu = nu0 + (nu1 - nu0) * k / 220;
        pts.push(V3(A.elementsToState(el.a, el.e, el.inc, el.Om, el.om, nu).r));
      }
      arcPts = pts;
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      if (transferLine) { transferLine.geometry.dispose(); transferLine.geometry = g; }
      // Spacecraft timing: mean anomaly grows at the constant rate n=sqrt(mu/a^3),
      // so M(s) = M0 + n*tof*s.  This makes the craft fast at perihelion (Kepler).
      craftEl = el;
      const E0 = 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(el.nu / 2),
                                Math.sqrt(1 + el.e) * Math.cos(el.nu / 2));
      craftM0 = E0 - el.e * Math.sin(E0);
      craftDM = Math.sqrt(A.MU_SUN / Math.pow(el.a, 3)) * tof * A.DAY;
      const vd = A.norm(A.sub(tr.v1, rE.v)), va = A.norm(A.sub(tr.v2, rM.v));
      set("tSum", ((vd + va) / 1e3).toFixed(3) + " km/s");
      set("tInc", (el.inc * 180 / Math.PI).toFixed(2) + "°");
    } else { craftEl = null; set("tSum", "—"); set("tInc", "—"); }
    set("tDepDate", jdToDate(dep)); set("tArrDate", jdToDate(arr));
    document.getElementById("tDepv").textContent = depOff;
    clockDays = 0;
  }

  function setExplain() {
    const el = document.getElementById("tExplain"); if (!el) return;
    const zh = "<b>发射日期偏移</b>：发射日 = 2026-01-01 + 偏移天数（在日历上选何时点火）。<br><b>飞行时间 (TOF)</b>：航天器在转移弧上从地球滑行到火星的天数；到达日 = 发射日 + TOF，它决定 Lambert 弧的形状。<br>动画中地球、火星、航天器按真实星历<b>同时运行</b>：发射时航天器位于地球，飞行中两行星各自前进，到达时航天器恰与火星相遇。";
    const en = "<b>Departure offset</b>: departure = 2026-01-01 + offset days (when to launch).<br><b>Time of flight (TOF)</b>: days the spacecraft coasts from Earth to Mars; arrival = departure + TOF, which sets the shape of the Lambert arc.<br>Earth, Mars and the spacecraft all move on the <b>real ephemeris clock</b>: the craft leaves Earth at launch and meets Mars at arrival.";
    el.innerHTML = global.I18N.getLang() ? en : zh;
    if (global.renderMath) global.renderMath(el);
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
    earthOrbit = orbitLine("earth", baseJD, 365.25, 0x3a7bd5); scene.add(earthOrbit);
    marsOrbit = orbitLine("mars", baseJD, 687, 0xe0673a); scene.add(marsOrbit);
    transferLine = new THREE.Line(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(transferLine);
    scene.add(new THREE.GridHelper(20, 20, 0x223052, 0x16203a));
    buildTransfer(); addControls(); ready = true;
  }
  function mesh(r, col, emis) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24),
      emis ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshStandardMaterial({ color: col }));
  }
  function addControls() {
    const el = renderer.domElement; let drag = false, px = 0, py = 0;
    el.addEventListener("mousedown", e => { drag = true; px = e.clientX; py = e.clientY; });
    window.addEventListener("mouseup", () => drag = false);
    window.addEventListener("mousemove", e => {
      if (!drag) return; cam.theta -= (e.clientX - px) * 0.01; cam.phi -= (e.clientY - py) * 0.01;
      cam.phi = Math.max(0.05, Math.min(Math.PI - 0.05, cam.phi)); px = e.clientX; py = e.clientY;
    });
    el.addEventListener("wheel", e => { e.preventDefault(); cam.r *= (1 + Math.sign(e.deltaY) * 0.08); cam.r = Math.max(8, Math.min(60, cam.r)); }, { passive: false });
  }
  function updateCam() {
    if (topView) camera.position.set(0, cam.r, 0.001);
    else camera.position.set(cam.r * Math.sin(cam.phi) * Math.cos(cam.theta),
      cam.r * Math.cos(cam.phi), cam.r * Math.sin(cam.phi) * Math.sin(cam.theta));
    camera.lookAt(0, 0, 0);
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    const hold = 40;                          // days held at arrival before looping
    if (playing) { clockDays += dt * speed * 30; if (clockDays > tof + hold) clockDays = 0; }
    const dep = baseJD + depOff;
    const nowJD = dep + Math.min(clockDays, tof);
    // planets move on the real clock
    earth.position.copy(V3(A.planetState("earth", nowJD).r));
    mars.position.copy(V3(A.planetState("mars", nowJD).r));
    // spacecraft positioned by Kepler timing (fast at perihelion)
    if (craftEl) {
      const s = Math.min(clockDays / tof, 1);
      const Mt = craftM0 + craftDM * s;
      const E = A.solveKepler(Mt, craftEl.e);
      const nu = A.trueFromEcc(E, craftEl.e);
      const st = A.elementsToState(craftEl.a, craftEl.e, craftEl.inc, craftEl.Om, craftEl.om, nu);
      craft.position.copy(V3(st.r));
      craft.visible = clockDays <= tof + 0.5;
    }
    updateCam(); renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  const M = {
    init() {
      bind("tDep", v => { depOff = +v; buildTransfer(); });
      bind("tTof", v => { tof = +v; document.getElementById("tTofv").textContent = v; buildTransfer(); });
      bind("tSpeed", v => { speed = +v; });
      document.getElementById("tPlay").onclick = function () { playing = !playing; this.textContent = playing ? global.I18N.t("play") : global.I18N.t("paused"); };
      document.getElementById("tView").onclick = () => { topView = !topView; };
      document.getElementById("tDepv").textContent = depOff;
      document.getElementById("tTofv").textContent = tof;
      setExplain();
    },
    onShow() {
      setExplain();
      if (!ready) {
        if (typeof THREE === "undefined") { document.getElementById("threeBox").innerHTML = "<p style='color:#9aa7c2;padding:20px'>three.js 未能加载。/ three.js failed to load.</p>"; return; }
        setup();
      } else { renderer.setSize(box.clientWidth, box.clientHeight); camera.aspect = box.clientWidth / box.clientHeight; camera.updateProjectionMatrix(); }
      last = 0; if (!raf) raf = requestAnimationFrame(loop);
    },
    onHide() { if (raf) { cancelAnimationFrame(raf); raf = null; } },
    setLang() { setExplain(); },
  };
  function bind(id, fn) { const e = document.getElementById(id); e.addEventListener("input", () => fn(e.value)); }
  global.ModThree = M;
})(window);
