/* Bilingual (zh / en) string table and helper. */
(function (global) {
  "use strict";
  const STR = {
    title:    ["飞向火星 · 地火轨道转移可视化", "Going to Mars · Earth–Mars Transfer Visualiser"],
    subtitle: ["MATH2850J 项目一 · 交互式补充材料", "MATH2850J Project 1 · Interactive supplement"],
    tab_hohmann:  ["霍曼转移", "Hohmann"],
    tab_porkchop: ["Lambert / Porkchop", "Lambert / Porkchop"],
    tab_three:    ["3D 真实转移", "3D transfer"],
    tab_formulas: ["公式与数据来源", "Formulas & Sources"],
    play:  ["暂停", "Pause"],
    paused:["播放", "Play"],
    reset: ["重置", "Reset"],
    // Hohmann
    h_title:["霍曼转移动画", "Hohmann transfer"],
    h_desc: ["两条共面圆轨道之间的最省能转移。拖动滑块改变轨道半径，观察速度增量与飞行时间如何变化。",
             "The minimum-energy transfer between two coplanar circular orbits. Drag the sliders to see how the burns and flight time change."],
    h_r1:["出发轨道半径 r₁ (AU)", "Departure radius r₁ (AU)"],
    h_r2:["目标轨道半径 r₂ (AU)", "Target radius r₂ (AU)"],
    h_speed:["动画速度", "Animation speed"],
    h_preset:["地→火预设", "Earth→Mars"],
    r_dv1:["Δv₁ (出发)", "Δv₁ (depart)"],
    r_dv2:["Δv₂ (到达)", "Δv₂ (arrive)"],
    r_dvtot:["总 Δv (日心)", "Total Δv (helio)"],
    r_tof:["飞行时间", "Flight time"],
    r_syn:["会合周期", "Synodic period"],
    r_phase:["发射相位角", "Phase angle"],
    // Porkchop
    p_title:["Lambert / Porkchop", "Lambert / Porkchop"],
    p_desc:["用真实星历与 Lambert 求解器扫描发射/到达日期。鼠标移到图上即可读取该日期对的转移参数并绘出轨迹。",
            "Scan departure/arrival dates with real ephemeris and a Lambert solver. Hover the plot to read the transfer and draw its trajectory."],
    p_year:["发射窗口起始年份", "Departure-window start year"],
    p_recompute:["重新计算", "Recompute"],
    p_findopt:["定位最优", "Find optimum"],
    pc_cap1:["Porkchop：颜色为 Δv 代理 (v∞,dep+v∞,arr)。点击图上任意点选取日期对。",
             "Porkchop: colour = Δv proxy (v∞,dep+v∞,arr). Click anywhere to pick a date pair."],
    pc_cap2:["对应的真实转移轨迹（日心俯视）。", "The corresponding transfer trajectory (heliocentric, top view)."],
    p_dep:["发射日期", "Departure"],
    p_arr:["到达日期", "Arrival"],
    p_sum:["Σ v∞", "Σ v∞"],
    p_computing:["计算中…", "Computing…"],
    p_done:["完成。点击图上任意点读取数据。", "Done. Click anywhere to read values."],
    // 3D
    t_title:["3D 真实转移", "3D real transfer"],
    t_desc:["三维日心视图，显示火星 1.85° 倾角与真实 Lambert 转移弧。拖动旋转，滚轮缩放。",
            "Heliocentric 3-D view showing Mars's 1.85° inclination and the real Lambert arc. Drag to rotate, scroll to zoom."],
    t_dep:["发射日期偏移 (天)", "Departure offset (days)"],
    t_tof:["飞行时间 (天)", "Flight time (days)"],
    t_topview:["切换视角", "Toggle view"],
    t_inc:["转移轨道倾角", "Transfer inclination"],
    t_speed:["动画速度", "Animation speed"],
    t_depdate:["发射日期", "Departure date"],
    t_arrdate:["到达日期", "Arrival date"],
    // Formulas page
    f_part1:["第 i 部分", "Part i"],
    f_part2:["第 ii 部分", "Part ii"],
    f_part3:["第 iii 部分", "Part iii"],
    f_sources:["数据来源", "Data sources"],
    // Tools
    x_title:["拓展工具", "Extras"],
    x_oberth:["Oberth 效应", "Oberth effect"],
    x_sling:["引力弹弓", "Gravity assist"],
    x_biell:["双椭圆 vs 霍曼", "Bi-elliptic vs Hohmann"],
    ob_desc:["固定 Δv=1 km/s 时，比能量增益 ΔE=v·Δv+½Δv² 随点火速率线性增长——深井高速点火更划算。",
             "For a fixed Δv=1 km/s, the energy gain ΔE=v·Δv+½Δv² grows linearly with burn speed — burning fast, deep in the well, pays off."],
    ob_slide:["点火速率 v (km/s)", "Burn speed v (km/s)"],
    sl_desc:["金星借力：偏转角 sin(δ/2)=1/(1+rₚv∞²/μ)，单次借力最大日心 Δv=2v∞sin(δ/2)。",
             "Venus flyby: turn sin(δ/2)=1/(1+rₚv∞²/μ); max heliocentric Δv=2v∞sin(δ/2) per flyby."],
    sl_slide:["接近速度 v∞ (km/s)", "Approach speed v∞ (km/s)"],
    bi_desc:["双椭圆经远处中间点变轨。仅当半径比 r₂/r₁≳11.94 时才比霍曼省；地火比 1.52，霍曼更优。",
             "Bi-elliptic routes via a far apoapsis. It only beats Hohmann when r₂/r₁≳11.94; Earth→Mars is 1.52, so Hohmann wins."],
    bi_slide:["半径比 r₂/r₁", "Radius ratio r₂/r₁"],
    foot:["轨道力学引擎（Kepler / Lambert / Standish 星历）由本项目 Python 代码移植，数值经交叉验证。",
          "The orbital-mechanics engine (Kepler / Lambert / Standish ephemeris) is ported from the project's Python code and cross-validated."],
  };

  let lang = 0; // 0 = zh, 1 = en
  function t(key) { return STR[key] ? STR[key][lang] : key; }
  function setLang(l) { lang = l; apply(); }
  function getLang() { return lang; }
  function apply() {
    document.documentElement.lang = lang ? "en" : "zh";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const k = el.getAttribute("data-i18n");
      if (STR[k]) el.textContent = STR[k][lang];
    });
    if (global.onLangChange) global.onLangChange();
  }
  global.I18N = { t, setLang, getLang, apply, STR };
})(window);
