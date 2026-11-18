# Bistro's Tavern

Bistro 的像素风个人主页。纯静态站，Astro + TypeScript + 手写 CSS，托管在 GitHub Pages，自定义域名 `jiuhuweisi.me`。

## 本地开发

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # 产物 dist/
npm run preview  # 预览构建结果
npm run check    # Astro + TypeScript 检查
```

## 部署

站点由 GitHub Pages 从 `main` 分支的 `/docs` 目录静态发布；`docs/.nojekyll` 关掉 Jekyll，保证 `_astro/` 里的 CSS 与字体不被吞掉。`public/CNAME`、`docs/CNAME` 与仓库根目录 `CNAME` 都保留 `jiuhuweisi.me`，**任何时候都不要删**。

改完源码后更新线上：

```bash
npm run build
rm -rf docs && cp -r dist docs && touch docs/.nojekyll
git add -A && git commit -m "Update site" && git push origin main
```

`deploy-workflow.yml` 是等价的 GitHub Actions 自动构建配置。当前 GitHub CLI 的 OAuth token 缺少 `workflow` scope，无法写 `.github/workflows/`，所以继续用 `/docs` 静态发布。授权后切换：

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows && cp deploy-workflow.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml && git commit -m "Enable Actions deploy" && git push origin main
```

再到仓库 **Settings → Pages → Build and deployment** 把 Source 改成 **GitHub Actions**。这一步只申请 `workflow` 一个 scope，不要申请更宽的权限；未授权前不要假装 Actions 已启用。

自定义域名证书状态见文末「HTTPS 状态」。

## 添加 / 修改项目

只改 `src/data/projects.ts` 里的 `projects` 数组，页面会自动多出一张卡：

- 有真实地址：填 `url`（卡片整体点击 + 「访问项目」按钮）与 `repo`（GitHub 按钮）。
- 没有公开地址：省略 `url` / `repo`，卡片只显示介绍、状态和「暂无公开链接」，不会出现假按钮。
- `category` 决定委托板筛选分组；`status` 取 `active` / `wip` / `experiment` / `done` / `unreleased`。
- `icon` 用 `src/data/icons.ts` 里的 12×12 像素精灵名；新精灵也加在那一处，构建时会自动校验尺寸。
- `detail` 是可选的「委托详档」，会自动在委托板下方生成一张档案卡：
  - `problem`（必填，解决什么问题）、`stack`（技术）、`state`（当前状态）、`areas`（方向清单）、`links`（真实分项链接）。
  - **所有字段都可以省略，缺什么就隐藏什么**。没有公开运行截图或 Demo 时不要编造，也不要塞假图片。
  - 带 `detail` 的卡片底部会自动多一个「详档 ▾」锚点，筛选时详档与卡片同步显示/隐藏。

## 其他配置

- 传送门平台：`src/data/site.ts` 的 `socials`，只放真实存在的地址（GitHub / X / Bilibili / 抖音）。
- 酒馆伙伴：`src/data/companions.ts`。**Bistro 才是店主**；GPT 龙娘是「酒馆管事 · 负责看店」，鲸戒是「聊天店员 · 负责陪聊」，别写反。`art` 指向 `public/images/` 下的透明背景 WebP 立绘，留空自动回退问号占位卡。
- 首屏插画：`public/images/tavern-hero.webp`（1600×901 桌面）与 `tavern-hero-sm.webp`（820×462 手机），`og-cover.webp` 是分享图。主视觉用 eager，其余图片 lazy。
- 头图动效：`Hero.astro` 的 `.scene-fx` 是覆盖在原插画上的轻量图层（6 处暖灯光晕、月亮呼吸光、Zzz 上浮、桌面高光），`BaseLayout.astro` 生成随机星点并做 ±3px 鼠标视差，样式在 `global.css` 的 `living tavern scene` 段。没有视频、没有新依赖；`prefers-reduced-motion: reduce` 下停掉全部动画。
- **手机端头图比例**：640px 断点下 `.scene-frame` 用 `aspect-ratio: 1600 / 901` 保持原图比例，`object-fit: cover` 但几乎不裁切，光效层 / Zzz / 热区 / 彩蛋按钮沿用桌面同一套百分比坐标。曾经把容器改成 `1 / 1` 导致鲸戒被切掉半张脸，并用 `177.6%` 宽度补偿光效坐标，这套做法**已经废弃**，不要恢复。
- V1.2 新增 `.scene-motes`、`[data-actor-zone]` 三角色热区、`.tavern-dialogue` 对话框、`.tavern-player` 点唱机；V1.3 新增 `.frame-layer` 与 `.quest-dossier`。

## V1.2 · 动态酒馆

**所有内容集中在 `src/data/tavern.ts`** —— 三角色台词池、五组联动剧情 + 隐藏事件、热区坐标（相对原图 1600×901 的归一化比例）、交互节奏、`BGM` 参数、逐帧素材清单。运行时逻辑在 `src/scripts/tavern.ts`（由 `BaseLayout.astro` 的 `<script>` 打包，无第三方依赖）。

- **热区**：`ACTORS[].zone` 是归一化坐标，`layoutZones()` 读取 `object-fit: cover` / `object-position` 的真实绘制矩形换算成像素，并在 resize 与图片 load 后重算；桌面 16:9 与手机 16:9 都能对齐。
- **对话框**：固定在视口底部，不遮挡插画人物、不产生布局偏移。普通台词 5.2s 自动收起；剧情按 beat 链式播放（3.6s/句），点角色快进，右上角「跳过 ▶」或 Esc 结束，冷却 26s、前 8 次点击不会触发、默认概率 7%。
- **鲸戒**：默认睡觉，首次点击抽「被叫醒」台词并收起叠加 Zzz，28s 无互动自动睡回去。猫咪 2.6s 内连点 3 次触发 `CAT_COMBO_LINES`，触发后计数清零。
- **BGM**：唯一指定曲目 `public/audio/moonlight-at-bistros-tavern.mp3`（184.4s / 7.1MB）。实测尾部 182.93–184.41s 是纯数字静音、音乐在 182.35s 已渐弱结束，循环区间 `0.08s → 182.35s`，末端 1.2s 双 `HTMLAudioElement` 交叉淡化；没有截尾声、没有重新编码，不用原生 `loop`。
- **音频管理器（V1.3 修复）**：全站只有一个 `TavernAudio` 实例，所有 BGM 音轨登记在 `voices: Set<HTMLAudioElement>`，暂停 / 静音 / 音量遍历全部音轨，`dropVoice()` 是唯一销毁入口；`booted` + `window.__tavernAudioBooted` + `audioSingleton` 三重单例守卫，避免脚本重复注入造成「BGM 二重奏」。
- **播放器**：`TavernPlayer.astro`，默认收起成小音符按钮（避免挡住头图，尤其手机端）。播放/暂停、音量、静音、循环、角色音效开关、收起状态写入 `localStorage` 的 `tavern.audio.v1`。**默认音量 18%、循环开、角色音效开、首次进入尝试自动播放**；被浏览器拦截时只注册一次 `pointerdown / keydown / touchend` 手势回退，不弹窗、不反复重试，显式暂停会撤销回退。音效 220ms 节流防叠音，触发时 BGM 短暂降到 32%；后台标签页自动暂停音轨与动画。`preload="metadata"`，首屏不下载 7MB。

## V1.3 · 真实动作帧与委托详档

### 真实动作（只上线通过逐帧复核的部分）

用《Character Animation Pack v1.0》**只做动作设计与时序参考**（它是带紫底、边框、文字的排版海报，不是 Sprite Sheet，绝不能直接裁贴）。所有候选帧都从 `tavern-hero.webp` 局部生成透明 PNG，叠回原图放大 5× 逐帧复核，共三轮：

| 动作 | 结论 | 原因 |
| --- | --- | --- |
| 猫咪睁眼 + 动耳 | ✅ 已上线 | 只改 329 个不透明像素，背景完全不动 |
| 龙娘眨眼 | ❌ 否决 | 紫瞳/眼线紧贴刘海，擦除会留紫色残影或粉色缺口 |
| 鲸戒睡醒 / 睁眼 | ❌ 否决 | 必须同时去掉原图自带的白色 `ZzZ` 气泡，三种背景修复都留下描边或彩色噪点矩形 |
| 猫咪抬头（P1） | ❌ 否决 | 整幅横条上移会破坏吧台背景并产生接缝 |

`public/images/frames/` 目前只有 `cat-rest.png`（常驻 idle，全透明）与 `cat-open.png`（睁眼 + 动耳）；`FRAME_ASSETS` 里只有 `cat` 配了这两帧，dragon / whale / plate 保持留空 = 原始静态图。

`TavernFrames` 控制器按状态驱动，不做无限轮播：图层插在 `.scene-frame__art` 内部并继承底图的 `sceneBreathe` 呼吸动画，CSS 再补上与 `picture` 相同的 `scale(1.02)` + `--px/--py` 视差变换，保证逐像素对齐、不漂移、不闪烁。动作帧在页面加载阶段就预取（只有几 KB，避免慢链路下第一次点击赶不上 1.5s 停留窗口）。点击猫咪播放一次动作帧后 `frameHoldMs`（1500ms）自动回 idle；重复触发先撤销旧定时器，不叠加。`reduced-motion` / 后台标签页直接跳过。

原图自带的白色 `Zzz` 气泡属于插画美术，无法在鲸戒醒来时单独隐藏；隐藏的只是叠加的暖金小 `z` 图层。要补齐剩下三个动作，需要画师按 `src/data/tavern.ts` 第 5 节的规格提供正式透明帧（1600×901、同一像素网格、每帧只画对应 bbox、RGBA）。

### 委托详档

带 `detail` 的项目在委托板下方生成深紫档案卡，展示「解决什么问题 / 用到的东西 / 当前状态 / 实验方向 / 真实链接」，缺字段自动隐藏。`ai-automation-lab` 的九个实验方向完整保留，状态标为「进行中」，不把未验证实验写成已完成。整个站点不含任何假截图、假 Demo、假数据。

## HTTPS 状态

- DNS A 记录指向 GitHub Pages 的 `185.199.108.153` 等四个 IP；`bridge.jiuhuweisi.me` 是独立解析，**从未改动**。
- 正常 TLS 校验直连四个 Pages IP 均报 `Hostname mismatch`，说明自定义域名证书尚未签发。因此 **没有开启 Enforce HTTPS**（否则会 301 到一个无有效证书的 HTTPS），也没改 DNS、没删 CNAME、没替换证书。
- 本机 CDP 调试时可用 `Security.setIgnoreCertificateErrors` 做内容冒烟，但那**不是修复**，只是绕过本机代理的证书问题。等 GitHub 签发证书后再开 Enforce HTTPS。

## 三个后续工具（规划，未创建仓库）

| 工具 | MVP | 可复用现有成果 |
| --- | --- | --- |
| VPS Health Check | 单点定时探测 + 状态页 + 异常通知，只读采集，不碰线上服务 | 现有只读巡检脚本、四端点探测与 PMTU 排查流程 |
| Agent Cost Tracker | 按模型/任务记 token 与费用，本地 CSV/SQLite + 简单图表 | 多模型实验记录、提示词工程模板 |
| Pixel Tavern Interaction Engine | 把 `tavern.ts` 的状态机、热区换算、帧控制器抽成独立小库 | 本站 `TavernLife` / `TavernFrames` / `layoutZones()` |

三者都只做设计评估，**没有创建空仓库、没有扩大公开范围、没有推送任何服务器代码或敏感配置**。要新建公共仓库前须先单独确认。
