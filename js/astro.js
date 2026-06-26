/* =====================================================================
 * astro.js  --  Orbital-mechanics engine (browser + Node), no deps.
 * Ported from the project's Python code (constants.py, orbital.py,
 * lambert.py).  SI units internally (m, s).  Verified against the Python
 * results and the Curtis textbook example.
 * ===================================================================== */
(function (global) {
  "use strict";

  const MU_SUN = 1.32712440018e20;      // m^3/s^2
  const MU_EARTH = 3.986004418e14;
  const MU_MARS = 4.282837e13;
  const AU = 1.495978707e11;            // m
  const DAY = 86400.0;
  const R_EARTH = 6.371e6, R_MARS = 3.3895e6;

  // Standish & Williams J2000 elements (Table 1, 1800-2050).
  // [value, rate per Julian century].  Angles in degrees; a in au.
  const ELEM = {
    earth: {
      a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392],
      I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981],
      varpi: [102.93768193, 0.32327364], Omega: [0.0, 0.0],
    },
    mars: {
      a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882],
      I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499],
      varpi: [-23.94362959, 0.44441088], Omega: [49.55953891, -0.29257343],
    },
  };

  const d2r = Math.PI / 180.0;

  // ---- vector helpers (3-component arrays) ----
  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
  function scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function norm(a) { return Math.sqrt(dot(a, a)); }

  // ---- Julian date (Gregorian) ----
  function julianDate(y, m, d, hh, mm, ss) {
    hh = hh || 0; mm = mm || 0; ss = ss || 0;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1))
             + d + B - 1524.5;
    jd += (hh + mm / 60 + ss / 3600) / 24;
    return jd;
  }
  const J2000 = 2451545.0;
  function centuries(jd) { return (jd - J2000) / 36525.0; }

  // ---- Kepler equation ----
  function solveKepler(M, e) {
    M = ((M + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 100; i++) {
      const dE = -(E - e*Math.sin(E) - M) / (1 - e*Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    return E;
  }
  function trueFromEcc(E, e) {
    return 2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),
                        Math.sqrt(1-e)*Math.cos(E/2));
  }

  // ---- elements -> heliocentric state (J2000 ecliptic) ----
  function elementsToState(a, e, I, Om, om, nu, mu) {
    mu = mu || MU_SUN;
    const p = a * (1 - e*e);
    const r = p / (1 + e*Math.cos(nu));
    const rpf = [r*Math.cos(nu), r*Math.sin(nu), 0];
    const k = Math.sqrt(mu / p);
    const vpf = [-k*Math.sin(nu), k*(e + Math.cos(nu)), 0];
    const cO=Math.cos(Om), sO=Math.sin(Om), cI=Math.cos(I), sI=Math.sin(I),
          co=Math.cos(om), so=Math.sin(om);
    const R = [
      [cO*co - sO*so*cI, -cO*so - sO*co*cI,  sO*sI],
      [sO*co + cO*so*cI, -sO*so + cO*co*cI, -cO*sI],
      [so*sI,            co*sI,             cI],
    ];
    function mul(M, v) {
      return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
              M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
              M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
    }
    return { r: mul(R, rpf), v: mul(R, vpf) };
  }

  // ---- Standish approximate planetary state ----
  function planetState(name, jd) {
    const el = ELEM[name];
    const T = centuries(jd);
    const a = (el.a[0] + el.a[1]*T) * AU;
    const e = el.e[0] + el.e[1]*T;
    const I = (el.I[0] + el.I[1]*T) * d2r;
    const L = el.L[0] + el.L[1]*T;
    const varpi = el.varpi[0] + el.varpi[1]*T;
    const Omega = (el.Omega[0] + el.Omega[1]*T) * d2r;
    const om = varpi*d2r - Omega;
    let M = L - varpi;
    M = ((M + 180) % 360 + 360) % 360 - 180;
    const E = solveKepler(M*d2r, e);
    const nu = trueFromEcc(E, e);
    return elementsToState(a, e, I, Omega, om, nu);
  }

  // ---- Stumpff functions ----
  function stumpffC(z) {
    if (z > 1e-9) { const s=Math.sqrt(z); return (1-Math.cos(s))/z; }
    if (z < -1e-9){ const s=Math.sqrt(-z); return (Math.cosh(s)-1)/(-z); }
    return 0.5 - z/24 + z*z/720;
  }
  function stumpffS(z) {
    if (z > 1e-9) { const s=Math.sqrt(z); return (s-Math.sin(s))/(s*s*s); }
    if (z < -1e-9){ const s=Math.sqrt(-z); return (Math.sinh(s)-s)/(s*s*s); }
    return 1/6 - z/120 + z*z/5040;
  }

  // ---- Universal-variable Lambert solver (single revolution) ----
  function lambert(r1, r2, dt, mu, prograde) {
    mu = mu || MU_SUN;
    if (prograde === undefined) prograde = true;
    const R1 = norm(r1), R2 = norm(r2);
    const cr = cross(r1, r2);
    let cosdnu = dot(r1, r2) / (R1*R2);
    cosdnu = Math.max(-1, Math.min(1, cosdnu));
    let dnu;
    if (prograde) dnu = (cr[2] >= 0) ? Math.acos(cosdnu) : 2*Math.PI-Math.acos(cosdnu);
    else          dnu = (cr[2] <  0) ? Math.acos(cosdnu) : 2*Math.PI-Math.acos(cosdnu);
    const A = Math.sin(dnu) * Math.sqrt(R1*R2 / (1 - cosdnu));
    if (Math.abs(A) < 1e-30) return null;

    function yOf(z) {
      return R1 + R2 + A*(z*stumpffS(z) - 1)/Math.sqrt(stumpffC(z));
    }
    function F(z) {
      const C = stumpffC(z), S = stumpffS(z);
      const y = R1 + R2 + A*(z*S - 1)/Math.sqrt(C);
      return Math.pow(y/C, 1.5)*S + A*Math.sqrt(y) - Math.sqrt(mu)*dt;
    }
    let zlo = -4*Math.PI*Math.PI, zhi = 4*Math.PI*Math.PI - 1e-6;
    while (yOf(zlo) < 0 && zlo < zhi) zlo += 0.1;
    let Flo = F(zlo), Fhi = F(zhi);
    if (!isFinite(Flo) || !isFinite(Fhi) || Flo*Fhi > 0) return null;
    let z = 0.5*(zlo+zhi);
    for (let i = 0; i < 2000; i++) {
      const Fz = F(z);
      if (Math.abs(Fz) < 1e-6*Math.sqrt(mu)*dt || (zhi-zlo) < 1e-10) break;
      if (Flo*Fz < 0) zhi = z; else { zlo = z; Flo = Fz; }
      z = 0.5*(zlo+zhi);
    }
    const y = yOf(z);
    const f = 1 - y/R1, g = A*Math.sqrt(y/mu), gd = 1 - y/R2;
    const v1 = scale(sub(r2, scale(r1, f)), 1/g);
    const v2 = scale(sub(scale(r2, gd), r1), 1/g);
    return { v1: v1, v2: v2 };
  }

  // ---- analytic Hohmann (coplanar circular) ----
  function hohmann(r1, r2, mu) {
    mu = mu || MU_SUN;
    const at = 0.5*(r1+r2);
    const vc1 = Math.sqrt(mu/r1), vc2 = Math.sqrt(mu/r2);
    const vp = Math.sqrt(mu*(2/r1 - 1/at)), va = Math.sqrt(mu*(2/r2 - 1/at));
    const dv1 = vp - vc1, dv2 = vc2 - va;
    const tof = Math.PI*Math.sqrt(at*at*at/mu);
    const n2 = Math.sqrt(mu/(r2*r2*r2));
    const alpha = Math.PI - n2*tof;
    const Te = 2*Math.PI*Math.sqrt(r1*r1*r1/mu);
    const Tm = 2*Math.PI*Math.sqrt(r2*r2*r2/mu);
    const Tsyn = 1/Math.abs(1/Te - 1/Tm);
    return { at, et:(r2-r1)/(r2+r1), vc1, vc2, vp, va, dv1, dv2,
             dvTotal: Math.abs(dv1)+Math.abs(dv2), tof, alpha, Te, Tm, Tsyn };
  }

  const API = {
    MU_SUN, MU_EARTH, MU_MARS, AU, DAY, R_EARTH, R_MARS, ELEM,
    sub, add, scale, dot, cross, norm,
    julianDate, centuries, solveKepler, trueFromEcc,
    elementsToState, planetState, lambert, hohmann, stumpffC, stumpffS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.Astro = API;
})(typeof window !== "undefined" ? window : globalThis);
