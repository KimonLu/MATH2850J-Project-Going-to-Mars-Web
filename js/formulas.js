/* Formulas and data-source text, aligned with q1_q3_final/doc. */
(function (global) {
  "use strict";
  let box, sub = "i";
  const R = String.raw;

  const C = {
    i: [
      R`<h3>(i) 开普勒轨道、能量与 vis-viva 方程</h3>
      <p>二体相对运动满足 $\ddot{\mathbf r}=-\dfrac{\mu}{r^3}\mathbf r$，轨道为圆锥曲线：</p>
      <div class="eq">$$r(\theta)=\dfrac{p}{1+e\cos\theta},\qquad p=\dfrac{h^2}{\mu}.$$</div>
      <p>按离心率和轨道能量分类：</p>
      <ul>
        <li>圆 $e=0$、椭圆 $0<e<1$：$E<0$，为束缚轨道；</li>
        <li>抛物线 $e=1$：$E=0$，为临界逃逸；</li>
        <li>双曲线 $e>1$：$E>0$，无穷远处仍有剩余速度 $v_\infty$。</li>
      </ul>
      <h3>椭圆几何与能量</h3>
      <div class="eq">$$r_p=a(1-e),\quad r_a=a(1+e),\quad p=a(1-e^2),\quad b=a\sqrt{1-e^2}.$$</div>
      <div class="eq">$$E=\tfrac12 mv^2-\dfrac{GmM}{r}=-\dfrac{GmM}{2a}.$$</div>
      <h3>vis-viva 方程</h3>
      <div class="eq">$$v^2=\mu\!\left(\dfrac{2}{r}-\dfrac1a\right).$$</div>
      <p class="note">圆轨道速度为 $v_c=\sqrt{\mu/r}$，逃逸速度为 $v_{\mathrm{esc}}=\sqrt{2\mu/r}$。</p>`,
      R`<h3>(i) Keplerian orbits, energy, and the vis-viva equation</h3>
      <p>The two-body relative motion obeys $\ddot{\mathbf r}=-\dfrac{\mu}{r^3}\mathbf r$, and the orbit is a conic:</p>
      <div class="eq">$$r(\theta)=\dfrac{p}{1+e\cos\theta},\qquad p=\dfrac{h^2}{\mu}.$$</div>
      <p>Classified by eccentricity and orbital energy:</p>
      <ul>
        <li>circle $e=0$ and ellipse $0<e<1$: $E<0$, bound orbits;</li>
        <li>parabola $e=1$: $E=0$, marginal escape;</li>
        <li>hyperbola $e>1$: $E>0$, with residual speed $v_\infty$ at infinity.</li>
      </ul>
      <h3>Ellipse geometry and energy</h3>
      <div class="eq">$$r_p=a(1-e),\quad r_a=a(1+e),\quad p=a(1-e^2),\quad b=a\sqrt{1-e^2}.$$</div>
      <div class="eq">$$E=\tfrac12 mv^2-\dfrac{GmM}{r}=-\dfrac{GmM}{2a}.$$</div>
      <h3>Vis-viva equation</h3>
      <div class="eq">$$v^2=\mu\!\left(\dfrac{2}{r}-\dfrac1a\right).$$</div>
      <p class="note">Circular speed is $v_c=\sqrt{\mu/r}$; escape speed is $v_{\mathrm{esc}}=\sqrt{2\mu/r}$.</p>`,
    ],
    ii: [
      R`<h3>(ii) 霍曼转移</h3>
      <p>连接半径 $r_1,r_2$ 两圆轨道的最省能转移椭圆：</p>
      <div class="eq">$$a_t=\dfrac{r_1+r_2}{2},\qquad e_t=\dfrac{r_2-r_1}{r_2+r_1}.$$</div>
      <h3>两次速度增量（由 vis-viva）</h3>
      <div class="eq">$$\Delta v_1=\sqrt{\dfrac{\mu}{r_1}}\!\left(\sqrt{\dfrac{2r_2}{r_1+r_2}}-1\right),\quad
      \Delta v_2=\sqrt{\dfrac{\mu}{r_2}}\!\left(1-\sqrt{\dfrac{2r_1}{r_1+r_2}}\right).$$</div>
      <h3>飞行时间、会合周期、相位角</h3>
      <div class="eq">$$t_{\mathrm{tof}}=\pi\sqrt{\dfrac{a_t^3}{\mu}},\qquad
      T_{\mathrm{syn}}=\left|\dfrac{1}{T_\oplus}-\dfrac{1}{T_{\!\mars}}\right|^{-1},\qquad
      \alpha=\pi-n_2\,t_{\mathrm{tof}}.$$</div>
      <p class="note">地火理想圆轨道数值：$\Delta v_1=2.945,\ \Delta v_2=2.649\ \mathrm{km/s}$，$t_{\mathrm{tof}}=258.9$ 天，$T_{\mathrm{syn}}=2.135$ 年，$\alpha=44.3^\circ$。</p>`,
      R`<h3>(ii) Hohmann transfer</h3>
      <p>The minimum-energy transfer ellipse connecting two circular orbits of radii $r_1,r_2$ is</p>
      <div class="eq">$$a_t=\dfrac{r_1+r_2}{2},\qquad e_t=\dfrac{r_2-r_1}{r_2+r_1}.$$</div>
      <h3>The two burns from vis-viva</h3>
      <div class="eq">$$\Delta v_1=\sqrt{\dfrac{\mu}{r_1}}\!\left(\sqrt{\dfrac{2r_2}{r_1+r_2}}-1\right),\quad
      \Delta v_2=\sqrt{\dfrac{\mu}{r_2}}\!\left(1-\sqrt{\dfrac{2r_1}{r_1+r_2}}\right).$$</div>
      <h3>Flight time, synodic period, and phase angle</h3>
      <div class="eq">$$t_{\mathrm{tof}}=\pi\sqrt{\dfrac{a_t^3}{\mu}},\qquad
      T_{\mathrm{syn}}=\left|\dfrac{1}{T_\oplus}-\dfrac{1}{T_{\!\mars}}\right|^{-1},\qquad
      \alpha=\pi-n_2\,t_{\mathrm{tof}}.$$</div>
      <p class="note">Ideal circular Earth-Mars values: $\Delta v_1=2.945,\ \Delta v_2=2.649\ \mathrm{km/s}$, $t_{\mathrm{tof}}=258.9$ d, $T_{\mathrm{syn}}=2.135$ yr, $\alpha=44.3^\circ$.</p>`,
    ],
    iii: [
      R`<h3>(iii) Lambert 问题与 porkchop 图</h3>
      <p>给定 DE440s 中的地球出发状态和火星到达状态，Lambert 问题要求在给定飞行时间 $\Delta t$ 内连接两端点的日心速度 $\mathbf v_1,\mathbf v_2$。</p>
      <div class="eq">$$\cos\Delta\theta=\dfrac{\mathbf r_1\cdot\mathbf r_2}{r_1 r_2},\qquad
      A=\sin\Delta\theta\sqrt{\dfrac{r_1 r_2}{1-\cos\Delta\theta}}.$$</div>
      <div class="eq">$$F(z)=\left[\dfrac{y}{C(z)}\right]^{3/2}S(z)+A\sqrt{y}-\sqrt{\mu_\odot}\,\Delta t=0.$$</div>
      <p>解出 $z$ 后，由 Lagrange 系数得到转移端点速度：</p>
      <div class="eq">$$\mathbf v_1=\dfrac{\mathbf r_2-f\mathbf r_1}{g},\qquad
      \mathbf v_2=\dfrac{\dot g\,\mathbf r_2-\mathbf r_1}{g}.$$</div>
      <h3>porkchop 指标</h3>
      <div class="eq">$$\mathbf v_{\infty,E}=\mathbf v_1-\mathbf v_E(t_1),\qquad
      C_3=\|\mathbf v_{\infty,E}\|^2,\qquad
      \mathbf v_{\infty,M}=\mathbf v_2-\mathbf v_M(t_2).$$</div>
      <p>报告的主要决策指标为 patched-conic 总速度增量：</p>
      <div class="eq">$$\Delta v_{\mathrm{total}}=
      \left[\sqrt{v_{\infty,E}^2+\dfrac{2\mu_E}{r_{\mathrm{LEO}}}}-\sqrt{\dfrac{\mu_E}{r_{\mathrm{LEO}}}}\right]
      +
      \left[\sqrt{v_{\infty,M}^2+\dfrac{2\mu_M}{r_{\mathrm{LMO}}}}-\sqrt{\dfrac{\mu_M}{r_{\mathrm{LMO}}}}\right].$$</div>
      <p class="note">2026-2027 窗口中，报告同时给出最小总 $\Delta v$、最小 $C_3$、不超过最小总 $\Delta v+0.5\ \mathrm{km/s}$ 的最快点，以及时间-总 $\Delta v$ 的 Pareto 折中点。</p>`,
      R`<h3>(iii) Lambert's problem and porkchop maps</h3>
      <p>Given the DE440s Earth departure state and Mars arrival state, Lambert's problem asks for heliocentric velocities $\mathbf v_1,\mathbf v_2$ that connect the endpoints in a prescribed time $\Delta t$.</p>
      <div class="eq">$$\cos\Delta\theta=\dfrac{\mathbf r_1\cdot\mathbf r_2}{r_1 r_2},\qquad
      A=\sin\Delta\theta\sqrt{\dfrac{r_1 r_2}{1-\cos\Delta\theta}}.$$</div>
      <div class="eq">$$F(z)=\left[\dfrac{y}{C(z)}\right]^{3/2}S(z)+A\sqrt{y}-\sqrt{\mu_\odot}\,\Delta t=0.$$</div>
      <p>After solving for $z$, the Lagrange coefficients give the endpoint velocities:</p>
      <div class="eq">$$\mathbf v_1=\dfrac{\mathbf r_2-f\mathbf r_1}{g},\qquad
      \mathbf v_2=\dfrac{\dot g\,\mathbf r_2-\mathbf r_1}{g}.$$</div>
      <h3>Porkchop metrics</h3>
      <div class="eq">$$\mathbf v_{\infty,E}=\mathbf v_1-\mathbf v_E(t_1),\qquad
      C_3=\|\mathbf v_{\infty,E}\|^2,\qquad
      \mathbf v_{\infty,M}=\mathbf v_2-\mathbf v_M(t_2).$$</div>
      <p>The report's main decision metric is the patched-conic total impulse:</p>
      <div class="eq">$$\Delta v_{\mathrm{total}}=
      \left[\sqrt{v_{\infty,E}^2+\dfrac{2\mu_E}{r_{\mathrm{LEO}}}}-\sqrt{\dfrac{\mu_E}{r_{\mathrm{LEO}}}}\right]
      +
      \left[\sqrt{v_{\infty,M}^2+\dfrac{2\mu_M}{r_{\mathrm{LMO}}}}-\sqrt{\dfrac{\mu_M}{r_{\mathrm{LMO}}}}\right].$$</div>
      <p class="note">For the 2026-2027 opportunity, the report lists the minimum-total-Δv design, the minimum-C3 design, the fastest point within minimum total Δv + 0.5 km/s, and a time-total-Δv Pareto compromise.</p>`,
    ],
    src: [
      R`<h3>数据来源与建模范围</h3>
      <table class="src">
        <tr><td>星历</td><td>NASA/JPL DE440s SPK kernel，ECLIPJ2000 几何状态；网页静态数据由报告脚本从本地 kernel 采样生成。<br><a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp" target="_blank">NAIF de440s.bsp</a></td></tr>
        <tr><td>引力参数与半径</td><td>引力参数来自 DE440 kernel 常数：$\mu_\odot=132712440041.279388$，$\mu_E=398600.435507$，$\mu_M=42828.373621\ \mathrm{km^3/s^2}$；行星半径来自 NAIF PCK：$R_E=6378.1366\ \mathrm{km}$，$R_M=3396.19\ \mathrm{km}$。泊车轨道半径取对应天体半径加高度：地球 200 km LEO，火星 250 km LMO。<br><a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440_tech-comments.txt" target="_blank">JPL DE440 technical comments</a>；<a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc" target="_blank">NAIF pck00011.tpc</a></td></tr>
        <tr><td>Lambert 求解</td><td>零圈顺行、日心二体 Lambert；通用变量 Lagrange $f,g$ 形式，与报告 Python 脚本一致。</td></tr>
        <tr><td>扫描网格</td><td>默认 2026-2027 窗口：2026-07-01 至 2027-06-30，TOF 140-360 天，2 天网格；最小总 $\Delta v$ 和最小 $C_3$ 经过 0.25 天局部细化。</td></tr>
        <tr><td>模型不包含</td><td>有限时间点火、发射场纬度和地球自转、深空修正、第三体摄动、太阳光压、大气进入或气动捕获。</td></tr>
        <tr><td>参考</td><td>JPL Planetary and Lunar Ephemerides；Gooding (1990) 与 Izzo (2015) Lambert 方法；NASA Earth-Mars porkchop plot 资料。</td></tr>
      </table>`,
      R`<h3>Data sources and model scope</h3>
      <table class="src">
        <tr><td>Ephemeris</td><td>NASA/JPL DE440s SPK kernel, geometric states in ECLIPJ2000; the website's static data are sampled from the local kernel by the report script.<br><a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp" target="_blank">NAIF de440s.bsp</a></td></tr>
        <tr><td>GM and radii</td><td>Gravitational parameters come from the DE440 kernel constants: $\mu_\odot=132712440041.279388$, $\mu_E=398600.435507$, and $\mu_M=42828.373621\ \mathrm{km^3/s^2}$; planetary radii come from the NAIF PCK: $R_E=6378.1366\ \mathrm{km}$ and $R_M=3396.19\ \mathrm{km}$. Parking-orbit radii are the body radius plus altitude: 200 km circular LEO and 250 km circular LMO.<br><a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440_tech-comments.txt" target="_blank">JPL DE440 technical comments</a>; <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc" target="_blank">NAIF pck00011.tpc</a></td></tr>
        <tr><td>Lambert solver</td><td>Zero-revolution prograde heliocentric two-body Lambert transfer using the universal-variable Lagrange $f,g$ form, matching the report Python script.</td></tr>
        <tr><td>Scan grid</td><td>Default 2026-2027 window: 2026-07-01 to 2027-06-30, TOF 140-360 d, 2 d grid; minimum total Δv and minimum C3 are locally refined at 0.25 d resolution.</td></tr>
        <tr><td>Excluded effects</td><td>Finite burn duration, launch-site latitude and Earth rotation, midcourse correction, third-body perturbations, solar radiation pressure, atmospheric entry, and aerocapture.</td></tr>
        <tr><td>References</td><td>JPL Planetary and Lunar Ephemerides; Gooding (1990) and Izzo (2015) Lambert methods; NASA materials on Earth-Mars porkchop plots.</td></tr>
      </table>`,
    ],
  };

  function render() {
    const lang = global.I18N.getLang();
    box.innerHTML = C[sub][lang];
    if (global.renderMath) global.renderMath(box);
  }

  const M = {
    init() {
      box = document.getElementById("formulasBox");
      document.querySelectorAll(".ftab").forEach(b => b.onclick = () => {
        document.querySelectorAll(".ftab").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        sub = b.getAttribute("data-f");
        render();
      });
    },
    onShow() { render(); },
    onHide() {},
    setLang() { render(); },
  };

  global.ModFormulas = M;
})(window);
