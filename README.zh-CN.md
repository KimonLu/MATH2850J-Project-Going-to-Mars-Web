<p align="center">
  <img src="assets/background.png" alt="火星上空的航天器" width="100%">
</p>

<h1 align="center">Going to Mars</h1>
<p align="center"><strong>MATH2850J Honors Mathematics III</strong></p>

<p align="center">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

<p align="center"><em>“可上九天揽月<br>
可下五洋捉鳖<br>
谈笑凯歌还<br>
世上无难事<br>
只要肯登攀”</em><br>
<em>— 毛泽东</em></p>

<p align="center"><em>“地球是人类的摇篮，但是人类不会永远生活在摇篮里。”</em><br>
<em>— 康斯坦丁·齐奥尔科夫斯基</em></p>

本仓库是 MATH2850J 小组项目 **Going to Mars: From Conic Geometry to Transfer Design** 的配套可视化网站。网站以中英文双语呈现报告中经过核验的模型、计算与图像结果。

- 项目网页：[kimonlu.github.io/MATH2850J-Project-Going-to-Mars-Web](https://kimonlu.github.io/MATH2850J-Project-Going-to-Mars-Web/)
- 仓库地址：[KimonLu/MATH2850J-Project-Going-to-Mars-Web](https://github.com/KimonLu/MATH2850J-Project-Going-to-Mars-Web)

## 项目信息

- 课程：**MATH2850J Honors Mathematics III**
- 项目：**Going to Mars: From Conic Geometry to Transfer Design**
- 任课教授：**Horst Hohberger 教授**
- 小组：**Group 19**
- 组员：**Zhuo Chen, Chenming Tao, Peikai Mao, Kemeng Lu**
- 学校-学院：**SJTU-GC**

## 项目内容

项目建立了一套由解析二体力学逐步延伸至特定日期转移设计和引力辅助的模型层级。

1. **开普勒基础**：推导反平方中心力下的圆锥曲线轨道、椭圆几何、轨道能量和 vis-viva 方程。
2. **霍曼转移基准**：建立理想圆轨道、共面条件下的地球-火星霍曼转移，并分析脉冲、飞行时间和能量关系。
3. **基于星历的 Lambert 转移**：比较圆共面、JPL/Standish 长期摄动开普勒根数和 NASA/JPL DE440s 三类行星状态模型；针对 2026-2027 发射机会求解零周、顺行 Lambert 问题，并基于拼接圆锥指标分析 porkchop 图、局部稳健性和 Pareto 权衡。
4. **引力辅助**：以行星中心双曲线掠过几何分析偏转角、速度矢量改变量和参考系相关的能量交换，并重建木星/Voyager 1 参考案例。

## 主要结果

在报告声明的拼接圆锥模型内，推荐的最小总脉冲地球-火星设计于 **2026-11-01 06:00 UTC** 出发，于 **2027-09-07 12:00 UTC** 到达，飞行时间为 **310.25 天**。其地球出发特征能量为 **C3 = 9.27 km²/s²**，近地停车轨道注入与近火停车轨道捕获组成的双脉冲预算为 **5.696 km/s**。

该结果用于模型比较，并非可直接执行的任务轨迹。模型范围不包括有限推力燃烧、发射场几何、导航、航天器质量分级、大气进入等工程约束。

## 配套可视化网站

网站是交互式展示层，而非权威科学记录。最终提交的报告以及 `Project/` 中归档的脚本和数据，定义了数学假设、数值流程和正式结果。

网站包含：

- 中英文双语界面；
- 轨道与霍曼转移可视化；
- 基于 DE440s 的发射窗口、porkchop、稳健性、Pareto 与三维转移轨迹视图；
- 引力辅助页面，包括行星中心双曲线几何、历史掠过预设和日心速度矢量演示；
- 展示所用模型的公式与数据来源页面。

## AI 使用说明

本项目的数学建模与核心问题求解由小组成员独立完成。AI 工具仅作为头脑风暴、编程、审阅和展示的辅助工具：

- [DeepSeek Chat](https://chat.deepseek.com/)
- [ChatGPT](https://chatgpt.com/)
- [Grok](https://grok.com/)
- [Claude](https://claude.ai/)

所有与轨道传播、数值计算和可视化相关的 AI 辅助代码均经过小组成员严格人工检查。本配套网站的前端代码由 [Claude Code](https://www.anthropic.com/claude-code) 与 [OpenAI Codex](https://openai.com/codex/) 实现。前端实现并非本数学项目的核心内容；网站仅作为展示小组独立开发并经人工核验的模型、计算和可视化结果的呈现层。
