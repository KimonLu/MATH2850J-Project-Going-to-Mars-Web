# 飞向火星 · 地火轨道转移可视化 / Going to Mars — Transfer Visualiser

MATH2850J 项目一的交互式补充网站。纯前端、零构建、可直接部署到 GitHub Pages。
中英双语界面，四个可视化模块共用一个由本项目 Python 代码移植并交叉验证的轨道力学引擎。

## 模块
1. **霍曼转移动画** — 日心俯视，地火公转 + 转移椭圆动画，可调轨道半径与播放速度，实时显示 Δv、飞行时间、会合周期、相位角。
2. **Lambert / Porkchop** — 真实星历 + Lambert 求解器扫描「发射日 × 飞行时间」，**点击**图上任意点读取 C₃ / v∞ / TOF 并联动绘出真实转移轨迹；含原理说明与发射窗口（会合周期）解释。
3. **3D 真实转移** — three.js 三维场景，显示火星 1.85° 倾角与真实 Lambert 弧，可拖动旋转、滚轮缩放、航天器动画。
4. **拓展工具** — Oberth 效应、引力弹弓偏转角、双椭圆 vs 霍曼，均可滑块调参。

## 本地预览
直接双击 `index.html` 即可在浏览器打开。KaTeX 与 three.js 已**本地化**到 `vendor/` 目录，整站离线即可运行，无需联网。

## 部署到 GitHub Pages
```bash
cd mars_web
git init
git add .
git commit -m "Going to Mars transfer visualiser"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```
然后在 GitHub 仓库页面：**Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**。
约一分钟后访问 `https://<你的用户名>.github.io/<仓库名>/`。

> 仓库已含空的 `.nojekyll` 文件，避免 GitHub 的 Jekyll 处理静态资源。

## 文件结构
```
mars_web/
├─ index.html          # 页面与所有控件
├─ .nojekyll
├─ css/style.css       # 深空主题样式
└─ js/
   ├─ astro.js         # 轨道力学引擎（Kepler/Lambert/Standish 星历），可独立用 node 运行
   ├─ i18n.js          # 中英双语字符串表
   ├─ hohmann.js       # 模块1
   ├─ porkchop.js      # 模块2
   ├─ transfer3d.js    # 模块3 (three.js)
   ├─ formulas.js      # 模块4：公式与数据来源 (KaTeX)
   └─ app.js           # 标签导航 / 语言切换 / KaTeX 渲染 / 生命周期
└─ vendor/              # 本地化的 KaTeX 与 three.js（离线可用）
```

## 数值可信度
引擎与项目主报告的 Python 代码同源并经 node 交叉验证：霍曼 Δv₁=2.945、Δv₂=2.649 km/s；
Lambert 通过 Curtis 教科书例题；Standish 星历日心距与已知近/远日点吻合；porkchop 最优解与主报告一致。
