/* Module: Formulas & data sources (KaTeX-rendered, bilingual). */
(function (global) {
  "use strict";
  let box, sub = "i";

  const R = String.raw;  // keep LaTeX backslashes literal

  const C = {
    i: [
      // ---- zh ----
      R`<h3>(i) 开普勒轨道、能量与 vis-viva 方程</h3>
      <p>二体相对运动满足 $\ddot{\mathbf r}=-\dfrac{\mu}{r^3}\mathbf r$，其中 $\mu=GM$。轨道为一条圆锥曲线：</p>
      <div class="eq">$$r(\theta)=\dfrac{p}{1+e\cos\theta},\qquad p=\dfrac{h^2}{\mu}.$$</div>
      <p>按离心率（等价地，按总能量 $E$ 的符号）分类：</p>
      <ul>
        <li>圆 $e=0$、椭圆 $0<e<1$：$E<0$（束缚轨道）；</li>
        <li>抛物线 $e=1$：$E=0$（临界逃逸）；</li>
        <li>双曲线 $e>1$：$E>0$（逃逸后仍有剩余速度 $v_\infty$）。</li>
      </ul>
      <h3>椭圆几何</h3>
      <div class="eq">$$r_p=a(1-e),\quad r_a=a(1+e),\quad p=a(1-e^2),\quad b=a\sqrt{1-e^2}.$$</div>
      <h3>轨道总能量</h3>
      <p>引力势能 $U=-\dfrac{GmM}{r}$，故总机械能</p>
      <div class="eq">$$E=\tfrac12 mv^2-\dfrac{GmM}{r}=-\dfrac{GmM}{2a},$$</div>
      <p class="note">后一等号由近/远拱点的能量与角动量守恒（$r_pv_p=r_av_a$）联立得到，说明束缚轨道能量只依赖半长轴 $a$。</p>
      <h3>vis-viva 方程</h3>
      <div class="eq">$$v^2=GM\!\left(\dfrac{2}{r}-\dfrac1a\right).$$</div>
      <p class="note">特例：圆轨道 $v_c=\sqrt{\mu/r}$；逃逸速度 $v_{\mathrm{esc}}=\sqrt{2\mu/r}=\sqrt2\,v_c$。</p>`,
      // ---- en ----
      R`<h3>(i) Keplerian orbits, energy & the vis-viva equation</h3>
      <p>The two-body relative motion obeys $\ddot{\mathbf r}=-\dfrac{\mu}{r^3}\mathbf r$ with $\mu=GM$. The orbit is a conic:</p>
      <div class="eq">$$r(\theta)=\dfrac{p}{1+e\cos\theta},\qquad p=\dfrac{h^2}{\mu}.$$</div>
      <p>Classified by eccentricity (equivalently, by the sign of the energy $E$):</p>
      <ul>
        <li>circle $e=0$, ellipse $0<e<1$: $E<0$ (bound);</li>
        <li>parabola $e=1$: $E=0$ (marginal escape);</li>
        <li>hyperbola $e>1$: $E>0$ (residual speed $v_\infty$).</li>
      </ul>
      <h3>Ellipse geometry</h3>
      <div class="eq">$$r_p=a(1-e),\quad r_a=a(1+e),\quad p=a(1-e^2),\quad b=a\sqrt{1-e^2}.$$</div>
      <h3>Total orbital energy</h3>
      <p>With potential energy $U=-\dfrac{GmM}{r}$, the total mechanical energy is</p>
      <div class="eq">$$E=\tfrac12 mv^2-\dfrac{GmM}{r}=-\dfrac{GmM}{2a},$$</div>
      <p class="note">the last equality follows from energy + angular-momentum conservation at peri/apoapsis ($r_pv_p=r_av_a$): bound-orbit energy depends only on $a$.</p>
      <h3>vis-viva equation</h3>
      <div class="eq">$$v^2=GM\!\left(\dfrac{2}{r}-\dfrac1a\right).$$</div>
      <p class="note">Special cases: circular $v_c=\sqrt{\mu/r}$; escape $v_{\mathrm{esc}}=\sqrt{2\mu/r}=\sqrt2\,v_c$.</p>`,
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
      <p class="note">地火数值：$\Delta v_1=2.945,\ \Delta v_2=2.649\ \mathrm{km/s}$，$t_{\mathrm{tof}}=258.9$ 天，$T_{\mathrm{syn}}=2.135$ 年，$\alpha=44.3^\circ$。</p>
      <h3>真实任务 Δv（拼接圆锥 + Oberth）</h3>
      <div class="eq">$$\Delta v_{\mathrm{TMI}}=\sqrt{v_\infty^2+\dfrac{2\mu_\oplus}{r}}-\sqrt{\dfrac{\mu_\oplus}{r}},\qquad
      \dfrac{m_{\mathrm{prop}}}{m_0}=1-e^{-\Delta v/(g_0 I_{sp})}.$$</div>`,
      R`<h3>(ii) Hohmann transfer</h3>
      <p>The minimum-energy transfer ellipse between circular orbits $r_1,r_2$:</p>
      <div class="eq">$$a_t=\dfrac{r_1+r_2}{2},\qquad e_t=\dfrac{r_2-r_1}{r_2+r_1}.$$</div>
      <h3>The two burns (from vis-viva)</h3>
      <div class="eq">$$\Delta v_1=\sqrt{\dfrac{\mu}{r_1}}\!\left(\sqrt{\dfrac{2r_2}{r_1+r_2}}-1\right),\quad
      \Delta v_2=\sqrt{\dfrac{\mu}{r_2}}\!\left(1-\sqrt{\dfrac{2r_1}{r_1+r_2}}\right).$$</div>
      <h3>Flight time, synodic period, phase angle</h3>
      <div class="eq">$$t_{\mathrm{tof}}=\pi\sqrt{\dfrac{a_t^3}{\mu}},\qquad
      T_{\mathrm{syn}}=\left|\dfrac{1}{T_\oplus}-\dfrac{1}{T_{\!\mars}}\right|^{-1},\qquad
      \alpha=\pi-n_2\,t_{\mathrm{tof}}.$$</div>
      <p class="note">Earth-Mars: $\Delta v_1=2.945,\ \Delta v_2=2.649\ \mathrm{km/s}$, $t_{\mathrm{tof}}=258.9$ d, $T_{\mathrm{syn}}=2.135$ yr, $\alpha=44.3^\circ$.</p>
      <h3>Mission Δv (patched-conic + Oberth)</h3>
      <div class="eq">$$\Delta v_{\mathrm{TMI}}=\sqrt{v_\infty^2+\dfrac{2\mu_\oplus}{r}}-\sqrt{\dfrac{\mu_\oplus}{r}},\qquad
      \dfrac{m_{\mathrm{prop}}}{m_0}=1-e^{-\Delta v/(g_0 I_{sp})}.$$</div>`,
    ],
    iii: [
      R`<h3>(iii) Lambert 问题与 porkchop 图</h3>
      <p>给定两端位置 $\mathbf r_1,\mathbf r_2$ 与飞行时间 $\Delta t$，求连接弧的速度。通用变量法：转移角与几何量</p>
      <div class="eq">$$\cos\Delta\theta=\dfrac{\mathbf r_1\cdot\mathbf r_2}{r_1 r_2},\qquad
      A=\sin\Delta\theta\sqrt{\dfrac{r_1 r_2}{1-\cos\Delta\theta}}.$$</div>
      <h3>Stumpff 函数</h3>
      <div class="eq">$$C(z)=\dfrac{1-\cos\sqrt z}{z},\qquad S(z)=\dfrac{\sqrt z-\sin\sqrt z}{(\sqrt z)^3}\quad(z>0).$$</div>
      <p>令 $y(z)=r_1+r_2+A\dfrac{zS(z)-1}{\sqrt{C(z)}}$，解单变量方程（对 $z$ 二分）：</p>
      <div class="eq">$$F(z)=\left[\dfrac{y}{C}\right]^{3/2}S+A\sqrt{y}-\sqrt{\mu}\,\Delta t=0,$$</div>
      <p>再由 Lagrange 系数 $f=1-\tfrac{y}{r_1},\ g=A\sqrt{\tfrac{y}{\mu}},\ \dot g=1-\tfrac{y}{r_2}$ 得</p>
      <div class="eq">$$\mathbf v_1=\dfrac{\mathbf r_2-f\mathbf r_1}{g},\qquad \mathbf v_2=\dfrac{\dot g\,\mathbf r_2-\mathbf r_1}{g}.$$</div>
      <h3>porkchop 量</h3>
      <div class="eq">$$\mathbf v_{\infty,\mathrm{dep}}=\mathbf v_1-\mathbf v_\oplus,\quad
      C_3=v_{\infty,\mathrm{dep}}^2,\quad
      \mathbf v_{\infty,\mathrm{arr}}=\mathbf v_2-\mathbf v_{\!\mars}.$$</div>
      <p class="note">真实星历用 Standish 近似公式：$a=a_0+\dot a\,T$ 等，$T=(\mathrm{JD}-2451545)/36525$，解 $M=E-e\sin E$ 后旋转到黄道系。</p>`,
      R`<h3>(iii) Lambert's problem & the porkchop plot</h3>
      <p>Given endpoints $\mathbf r_1,\mathbf r_2$ and time of flight $\Delta t$, find the connecting velocities. Universal-variable method:</p>
      <div class="eq">$$\cos\Delta\theta=\dfrac{\mathbf r_1\cdot\mathbf r_2}{r_1 r_2},\qquad
      A=\sin\Delta\theta\sqrt{\dfrac{r_1 r_2}{1-\cos\Delta\theta}}.$$</div>
      <h3>Stumpff functions</h3>
      <div class="eq">$$C(z)=\dfrac{1-\cos\sqrt z}{z},\qquad S(z)=\dfrac{\sqrt z-\sin\sqrt z}{(\sqrt z)^3}\quad(z>0).$$</div>
      <p>With $y(z)=r_1+r_2+A\dfrac{zS(z)-1}{\sqrt{C(z)}}$, solve (bisection in $z$):</p>
      <div class="eq">$$F(z)=\left[\dfrac{y}{C}\right]^{3/2}S+A\sqrt{y}-\sqrt{\mu}\,\Delta t=0,$$</div>
      <p>then Lagrange coefficients $f=1-\tfrac{y}{r_1},\ g=A\sqrt{\tfrac{y}{\mu}},\ \dot g=1-\tfrac{y}{r_2}$ give</p>
      <div class="eq">$$\mathbf v_1=\dfrac{\mathbf r_2-f\mathbf r_1}{g},\qquad \mathbf v_2=\dfrac{\dot g\,\mathbf r_2-\mathbf r_1}{g}.$$</div>
      <h3>Porkchop quantities</h3>
      <div class="eq">$$\mathbf v_{\infty,\mathrm{dep}}=\mathbf v_1-\mathbf v_\oplus,\quad
      C_3=v_{\infty,\mathrm{dep}}^2,\quad
      \mathbf v_{\infty,\mathrm{arr}}=\mathbf v_2-\mathbf v_{\!\mars}.$$</div>
      <p class="note">Real positions use the Standish formulae: $a=a_0+\dot a\,T$ etc., $T=(\mathrm{JD}-2451545)/36525$; solve $M=E-e\sin E$ then rotate into the ecliptic frame.</p>`,
    ],
    src: [
      R`<h3>数据来源与参考</h3>
      <table class="src">
        <tr><td>$\mu_\odot$（日心引力参数）</td><td>$1.32712440018\times10^{20}\ \mathrm{m^3/s^2}$ — <a href="https://en.wikipedia.org/wiki/Standard_gravitational_parameter" target="_blank">Standard gravitational parameter (Wikipedia)</a></td></tr>
        <tr><td>天文单位 AU</td><td>$149\,597\,870\,700\ \mathrm m$（IAU 2012 精确定义）— <a href="https://en.wikipedia.org/wiki/Astronomical_unit" target="_blank">Astronomical unit</a></td></tr>
        <tr><td>地球/火星轨道根数与变率</td><td>Standish &amp; Williams 近似星历 — <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank">JPL: Approximate Positions of the Planets</a></td></tr>
        <tr><td>火星物理参数（$e=0.0934$，$i=1.85^\circ$）</td><td><a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" target="_blank">NASA NSSDCA Mars Fact Sheet</a></td></tr>
        <tr><td>霍曼转移参考值</td><td><a href="https://en.wikipedia.org/wiki/Hohmann_transfer_orbit" target="_blank">Hohmann transfer orbit</a> · <a href="https://marspedia.org/Earth-Mars_Transfer_Trajectory" target="_blank">Marspedia</a></td></tr>
        <tr><td>Lambert 问题</td><td><a href="https://en.wikipedia.org/wiki/Lambert%27s_problem" target="_blank">Lambert's problem</a>；H. D. Curtis, <i>Orbital Mechanics for Engineering Students</i>, 3rd ed.（算法 5.2）</td></tr>
        <tr><td>“霍曼是无用虚构”</td><td>D. Hammen — <a href="https://space.stackexchange.com/a/14597" target="_blank">Space Exploration Stack Exchange</a></td></tr>
      </table>
      <p class="note">本页公式与数值与主报告完全一致。</p>`,
      R`<h3>Data sources &amp; references</h3>
      <table class="src">
        <tr><td>$\mu_\odot$ (Sun GM)</td><td>$1.32712440018\times10^{20}\ \mathrm{m^3/s^2}$ — <a href="https://en.wikipedia.org/wiki/Standard_gravitational_parameter" target="_blank">Standard gravitational parameter (Wikipedia)</a></td></tr>
        <tr><td>Astronomical unit</td><td>$149\,597\,870\,700\ \mathrm m$ (IAU 2012, exact) — <a href="https://en.wikipedia.org/wiki/Astronomical_unit" target="_blank">Astronomical unit</a></td></tr>
        <tr><td>Earth/Mars elements &amp; rates</td><td>Standish &amp; Williams approximate ephemeris — <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank">JPL: Approximate Positions of the Planets</a></td></tr>
        <tr><td>Mars parameters ($e=0.0934$, $i=1.85^\circ$)</td><td><a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" target="_blank">NASA NSSDCA Mars Fact Sheet</a></td></tr>
        <tr><td>Hohmann reference values</td><td><a href="https://en.wikipedia.org/wiki/Hohmann_transfer_orbit" target="_blank">Hohmann transfer orbit</a> · <a href="https://marspedia.org/Earth-Mars_Transfer_Trajectory" target="_blank">Marspedia</a></td></tr>
        <tr><td>Lambert's problem</td><td><a href="https://en.wikipedia.org/wiki/Lambert%27s_problem" target="_blank">Lambert's problem</a>; H. D. Curtis, <i>Orbital Mechanics for Engineering Students</i>, 3rd ed. (Algorithm 5.2)</td></tr>
        <tr><td>“Hohmann is a useless fiction”</td><td>D. Hammen — <a href="https://space.stackexchange.com/a/14597" target="_blank">Space Exploration Stack Exchange</a></td></tr>
      </table>
      <p class="note">The formulas and values on this page are consistent with the main report.</p>`,
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
        b.classList.add("active"); sub = b.getAttribute("data-f"); render();
      });
    },
    onShow() { render(); },
    onHide() {},
    setLang() { render(); },
  };
  global.ModFormulas = M;
})(window);
