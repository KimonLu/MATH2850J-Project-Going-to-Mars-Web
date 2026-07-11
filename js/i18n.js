/* Bilingual (zh / en) string table and helper. */
(function (global) {
  "use strict";

  const STR = {
    title: ["飞向火星 · 地火轨道转移可视化", "Going to Mars · Earth-Mars Transfer Visualiser"],
    subtitle: ["MATH2850J 项目一 · 交互式补充材料", "MATH2850J Project 1 · Interactive supplement"],
    tab_hohmann: ["霍曼转移", "Hohmann"],
    tab_porkchop: ["Lambert / Porkchop", "Lambert / Porkchop"],
    tab_three: ["3D 真实转移", "3D transfer"],
    tab_flyby: ["飞掠 / 引力弹弓", "Fly-by / Slingshot"],
    tab_formulas: ["公式与数据来源", "Formulas & Sources"],
    play: ["暂停", "Pause"],
    paused: ["播放", "Play"],
    reset: ["重置", "Reset"],

    h_title: ["霍曼转移动画", "Hohmann transfer"],
    h_desc: ["两条共面圆轨道之间的最省能二脉冲转移。拖动滑块可观察理想圆轨道半径改变时的速度增量、飞行时间和相位角。", "The minimum-energy two-impulse transfer between two coplanar circular orbits. Drag the sliders to see how the burns, flight time, and phase angle change."],
    h_r1: ["出发轨道半径 r1 (AU)", "Departure radius r1 (AU)"],
    h_r2: ["目标轨道半径 r2 (AU)", "Target radius r2 (AU)"],
    h_speed: ["动画速度", "Animation speed"],
    h_preset: ["地球到火星", "Earth to Mars"],
    r_dv1: ["Δv1 (出发)", "Δv1 (depart)"],
    r_dv2: ["Δv2 (到达)", "Δv2 (arrive)"],
    r_dvtot: ["总 Δv (日心)", "Total Δv (helio)"],
    r_tof: ["飞行时间", "Time of flight"],
    r_syn: ["会合周期", "Synodic period"],
    r_phase: ["发射相位角", "Phase angle"],

    p_title: ["Lambert / Porkchop", "Lambert / Porkchop"],
    p_window: ["发射窗口", "Launch window"],
    p_optkind: ["定位方案", "Design to locate"],
    p_findopt: ["定位", "Locate"],
    pc_cap1: ["上图为总 Δv，下图为 C3；横轴为发射日偏移，纵轴为飞行时间。点击任一图的点会同步选择同一日期对。", "Top: total Δv. Bottom: C3. The x-axis is departure offset and the y-axis is time of flight. Clicking either plot selects the same date pair."],
    pc_cap2: ["对应日心俯视轨迹。", "Corresponding heliocentric top-view trajectory."],
    p_dep: ["发射时间", "Departure"],
    p_arr: ["到达时间", "Arrival"],
    p_totaldv: ["总 Δv", "Total Δv"],
    p_ready: ["DE440s/Lambert 静态网格已载入。点击图中任一点读取该转移。", "DE440s/Lambert static grid loaded. Click any point to inspect that transfer."],
    opt_min_total: ["最小总 Δv", "Minimum total Δv"],
    opt_min_c3: ["最小 C3", "Minimum C3"],
    opt_fast: ["快而不超支过多", "Fast within budget"],
    opt_pareto: ["Pareto 折中", "Pareto compromise"],

    t_title: ["3D 真实转移", "3D real transfer"],
    t_dep: ["发射日偏移 (天)", "Departure offset (days)"],
    t_tof: ["飞行时间 (天)", "Time of flight (days)"],
    t_topview: ["切换视角", "Toggle view"],
    t_inc: ["转移轨道倾角", "Transfer inclination"],
    t_speed: ["动画速度", "Animation speed"],
    t_depdate: ["发射时间", "Departure"],
    t_arrdate: ["到达时间", "Arrival"],
    t_best: ["最佳 Δv", "Best Δv"],

    fly_title: ["飞掠 / 引力弹弓", "Fly-by / Slingshot"],
    fly_cap: ["行星中心视图展示严格的二体双曲线；日心视图展示平面速度矢量叠加。", "The planet view shows a strict two-body hyperbola; the heliocentric view shows planar velocity-vector addition."],
    fly_view: ["视图", "View"],
    fly_view_planet: ["行星中心", "Planet frame"],
    fly_view_helio: ["日心速度矢量", "Heliocentric velocity vectors"],
    fly_planet: ["飞掠行星", "Fly-by planet"],
    fly_planet_venus: ["金星", "Venus"],
    fly_planet_mars: ["火星", "Mars"],
    fly_planet_jupiter: ["木星", "Jupiter"],
    fly_mode: ["参数模式", "Parameter mode"],
    fly_mode_free: ["自由参数", "Free parameters"],
    fly_mode_history: ["历史事件", "Historical event"],
    fly_event: ["历史事件", "Historical event"],
    fly_report_ref: ["报告木星参考案例", "Report Jupiter reference"],
    fly_vinf: ["双曲线剩余速度 v∞ (km/s)", "Hyperbolic excess speed v∞ (km/s)"],
    fly_alt: ["距行星表面高度 h (km)", "Altitude above planet h (km)"],
    fly_angle: ["入射 v∞ 方向 (deg)", "Incoming v∞ direction (deg)"],
    fly_turn: ["转向方向", "Turn direction"],
    fly_ccw: ["逆时针", "Counter-clockwise"],
    fly_cw: ["顺时针", "Clockwise"],
    fly_rp: ["近拱点半径 rp", "Periapsis radius rp"],
    fly_a: ["双曲线半长轴 ah", "Hyperbolic semi-major axis ah"],
    fly_e: ["双曲线偏心率 eh", "Hyperbolic eccentricity eh"],
    fly_delta: ["转向角 δ", "Turning angle δ"],
    fly_vector_dv: ["Δv∞,vector", "Δv∞,vector"],
    fly_before: ["|vbefore|", "|vbefore|"],
    fly_after: ["|vafter|", "|vafter|"],
    fly_helio_dv: ["Δ|v|helio", "Δ|v|helio"],
    fly_explain_planet: ["行星中心二体双曲线。历史预设仅复现所给遭遇标量，并非完整的导航轨迹重建。", "Planet-centred two-body hyperbola. Historical presets reproduce only the supplied encounter scalars, not a complete navigation reconstruction."],
    fly_explain_helio: ["理想化平面速度矢量叠加。改变入射方向可观察：行星系中 |v∞| 守恒，但日心速度可增可减。", "Ideal planar vector addition. Adjust the incoming direction to see why heliocentric speed can rise or fall while |v∞| is conserved in the planet frame."],
    fly_cap_planet: ["距离以统一 km 尺度绘制；行星圆盘和近拱点均未作视觉夸张。", "Physical distances share one km scale; the planet disc and periapsis are not visually exaggerated."],
    fly_cap_helio: ["全部箭头共用 km/s 尺度；日心速度模长变化取决于所选入射方向。", "All arrows share one km/s scale; the heliocentric speed change depends on the chosen incoming direction."],
    fly_no_events: ["所提供的数据集中没有火星历史飞掠事件；请使用自由参数。", "No supplied historical fly-by event is available for Mars. Use free parameters instead."],
    fly_event_note: ["预设标量来自所提供的历史事件表。来源", "Preset scalars from the supplied historical-event table. Source"],
    fly_report_note: ["报告参考案例：木星，h = 280,000 km，v∞ = 10.8 km/s。", "Report reference configuration: Jupiter, h = 280,000 km, v∞ = 10.8 km/s."],
    fly_ref_title: ["木星参考飞掠", "Jupiter reference fly-by"],
    fly_helio_title: ["日心速度矢量", "Heliocentric velocity vectors"],
    fly_scale: ["尺度", "scale"],
    fly_km: ["km", "km"],
    fly_speed: ["km/s", "km/s"],

    f_part1: ["第 i 部分", "Part i"],
    f_part2: ["第 ii 部分", "Part ii"],
    f_part3: ["第 iii 部分", "Part iii"],
    f_sources: ["数据来源", "Data sources"],
    foot: ["Lambert 网格、候选轨迹和行星状态均由本项目 Python 代码基于 NASA/JPL DE440s 生成。", "Lambert grids, candidate trajectories, and planetary states are generated by the project Python code from NASA/JPL DE440s."],
  };

  let lang = 0;
  function t(key) { return STR[key] ? STR[key][lang] : key; }
  function setLang(l) { lang = l; apply(); }
  function getLang() { return lang; }
  function apply() {
    document.documentElement.lang = lang ? "en" : "zh";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (STR[key]) el.textContent = STR[key][lang];
    });
    if (global.onLangChange) global.onLangChange();
  }

  global.I18N = { t, setLang, getLang, apply, STR };
})(window);
