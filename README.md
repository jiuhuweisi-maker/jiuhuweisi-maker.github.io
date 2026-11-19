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

## 部署（GitHub Actions 自动构建）

站点由 `.github/workflows/deploy.yml` 在每次 push 到 `main` 时自动构建并部署；也可在 Actions 页用 `Run workflow` 手动触发。工作流顺序为 `npm ci` → `npm run check`（Astro + TypeScript）→ `npm run build` → 产物校验 → `actions/deploy-pages`，**任何一步失败都不会部署**，线上保持上一次成功的版本。

自定义域名 `jiuhuweisi.me` 由 `public/CNAME` 构建进 `dist/CNAME`，切到 Actions 后不会掉；`public/.nojekyll` 保证 `_astro/` 里的 CSS 与字体不被 Jekyll 吞掉。工作流里有一条 `Verify deployment artifact` 断言，缺 `index.html` / `CNAME` / `.nojekyll` 会直接让构建失败。仓库根目录 `CNAME` 与 `docs/CNAME` 一并保留，**任何时候都不要删**。

改完源码后更新线上：

```bash
npm run check && npm run build   # 本地自检（可选，CI 会再跑一遍）
git add -A && git commit -m "Update site" && git push origin main
```

**不需要再手工同步 `docs/`**：Actions 直接从 `dist/` 部署，旧的「构建产物提交」步骤已移除。

### 回滚到 legacy `/docs`

`docs/` 保留着最后一次 `/docs` 静态发布的完整快照（含 `.nojekyll` 与 `CNAME`），**只作回滚备份**：CI 不读它、也不会更新它，因此它会逐渐落后于源码。若 Actions 出问题：

1. 仓库 **Settings → Pages → Build and deployment → Source** 改回 **Deploy from a branch**，分支 `main`、目录 `/docs`，保存。站点立即回到旧发布模式。
2. 若希望快照包含最新源码，先本地刷新再推送（这是唯一还需要写 `docs/` 的场景）：
   ```bash
   npm run build
   rm -rf docs && cp -r dist docs && touch docs/.nojekyll
   git add docs && git commit -m "Refresh legacy docs snapshot" && git push origin main
   ```
3. 要重新启用自动部署，把 Source 改回 **GitHub Actions** 即可，工作流文件无需改动；必要时 `gh workflow run deploy.yml` 手动跑一次。

`deploy-workflow.yml` 是同一份工作流的可读副本，改工作流时以 `.github/workflows/deploy.yml` 为准。2026-11-19 迁移记录：先推送工作流，确认 run `44369569106`（push 触发）的 build 与 deploy 全部通过后，才用 `PUT /repos/{owner}/{repo}/pages` 把 `build_type` 切为 `workflow`；切换时显式带上 `cname: "jiuhuweisi.me"`，域名未丢失。随后 run `44370062857`（手动触发）再次全绿，桌面 / 手机端 HTTPS、BGM、三角色互动与猫咪帧切换逐项验收通过。

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

- 传送门平台：`src/data/site.ts` 的 `socials`，只放真实存在的地址（GitHub / X / Bilibili / 抖音）。往数组里加一项，页面上就会自动多出一张目的地卡片，`href` / `icon` / `accent` 都要填；没有真实地址时不要写 `href`，宁可不加这张卡，也不要放假按钮。
- 酒馆伙伴：`src/data/companions.ts`。**Bistro 才是店主**；GPT 龙娘是「酒馆管事 · 负责看店」，鲸戒是「聊天店员 · 负责陪聊」，别写反。`art` 指向 `public/images/` 下的透明背景 WebP 立绘，换立绘时把新图放进 `public/images/` 再改这里的路径即可，组件不用动；留空自动回退问号占位卡。`lines` 是点击卡片随机抽取的台词，`role` 是身份徽章文案，`setting` 是设定说明，`status` 是右上角状态牌，都在这个文件里。
- 页面只给访客看内容：换立绘、加平台、改台词这类维护说明只写在本文档，不要出现在网页上。
- 首屏插画：`public/images/tavern-hero.webp`（1600×901 桌面）与 `tavern-hero-sm.webp`（820×462 手机），`og-cover.webp` 是分享图。主视觉用 eager，其余图片 lazy。
- 头图动效：`Hero.astro` 的 `.scene-fx` 是覆盖在原插画上的轻量图层（6 处暖灯光晕、月亮呼吸光、Zzz 上浮、桌面高光），`BaseLayout.astro` 生成随机星点并做 ±3px 鼠标视差，样式在 `global.css` 的 `living tavern scene` 段。`prefers-reduced-motion: reduce` 下停掉全部动画。V1.5 起头图另有 Veo/Omni 视频层（见 `V1.5` 章节），但静态插画始终是首屏与失败回退；视频层无依赖、无音轨。
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

## V1.4 · 视觉精修（无新功能）

- 章节上下留白 86 / 66 / 56px → 62 / 50 / 42px，标题区下边距 38 → 30px；头图比例与移动端适配不变。
- 店主档案左侧换成原创像素盾徽 `OwnerCrest.astro`（盾牌 + 酒杯 + 星 + 铆钉 + `OWNER · LV.01` 缎带），只画酒馆纹章，不画人物长相。
- 角色卡身份文案做成 RPG 职业徽章，台词框加名牌与像素角标，两张卡台词框底部对齐；立绘与角色数据未动。
- 四张传送门统一图标底板（34×34）、按钮宽度（82px）、简介两行高度与卡片最小高度；链接与 `rel` 未动。
- 首页标题区到头图加暖金引导线（不占布局高度）与画框上沿木质横梁。
- 页面上的换立绘 / 加平台路径提示全部移除，维护说明只保留在本文档「其他配置」。

## V1.5 · 动态头图视频（2026-11-19）

- 四段 **Frames-to-Video** 素材全部由 Google Flow 生成，首帧与尾帧都是同一张 `tavern-hero.webp`，固定 16:9 机位、无音轨。最终四段统一用 **Omni 1.2 Flash**（`dragon/whale/cat` 按 8 关键帧动作参考设计，`idle` 为待机循环）；首轮 Veo 版因中段变形/遮挡招牌被弃用，未上线。
- 素材在 `public/videos/{tavern-idle,dragon-react,whale-react,cat-react}.{webm,mp4}`（VP9 + H.264 双格式，各约 1.5–2.2 MB，共约 15 MB）。WebM 优先、MP4 兜底；静态 `tavern-hero.webp` 永远是首屏与失败回退。
- 统一状态机 `src/scripts/tavern-video.ts` 的 `TavernVideoManager`：STATIC / IDLE_LOADING / IDLE_PLAYING / REACT_LOADING / REACT_PLAYING / RETURNING / ERROR。集中管理，先让目标视频就绪再单层可见切换（不黑屏）；连点只保留最新一个待处理请求、不截断当前动画；剧情跳过取消待处理请求；切标签页暂停解码；失败/弱网/reduced-motion 回退静态图。与 `TavernAudio` 完全独立，视频全部静音无音轨。
- 接入点在 `src/scripts/tavern.ts` 的 `boot()`（创建 manager）与 `TavernLife.onActor()`（触发 react）/ `skipStory()`（取消 pending）；视频层 CSS 在 `global.css` 的 `V1.5 Veo 头图视频层` 段，用与底图相同的 `scale(1.02)` 变换逐像素对齐。三角色热区、台词、剧情、BGM 均未改。
- 生成提示词与审核脚本在 `.cache/v15/`（`prompts.json` / `audit2.py`）；审核以首尾一致、动作可控、无变形为硬指标，画风漂移只记录（用户接受 AI 化画风）。动作参考图只用于设计动作序列，不改首帧约束。
- 素材缺口：AI 视频仍会有轻微画风软化；`whale/cat` 动作幅度受"不变形"约束而偏克制。没有画师提供的透明逐帧素材前，不追求逐像素完美。

## HTTPS 状态（2026-11-19 复核）

- DNS A 记录指向 GitHub Pages 的 `185.199.108.153` 等 IP；无 AAAA、无 CAA 限制；`bridge.jiuhuweisi.me` 是独立解析，**从未改动**。
- **证书已签发**：Let's Encrypt（`CN=jiuhuweisi.me`，SAN 含 `jiuhuweisi.me`），有效期 2026-11-18 16:46 UTC → 2027-02-16。直连四个 Pages IP 的正常 TLS 校验全部通过（TLS 1.3），浏览器侧主文档 `securityDetails` 主机名匹配、无 `certificateError` 事件。
- **2026-11-19 切到 GitHub Actions 后复核**：`https://jiuhuweisi.me/` 严格 TLS 校验 200、证书主机名匹配、浏览器侧 0 个 `Security.certificateError`，`CNAME` / `_astro` 的 JS 与 CSS / BGM / 猫咪帧 / 头图全部 200，控制台 0 错误。但此时 Pages 证书状态为 `dns_changed`（`Detected a change to DNS settings. Requesting a new certificate.`），`https_enforced` 回落为 `false`，`http://` 暂时不再 301 跳转。尝试通过 API 恢复 Enforce HTTPS 被 GitHub 拒绝：`The certificate has not finished being issued`（HTTP 404）。这是 GitHub 侧证书重签流程，**未改 DNS、未删 CNAME、未替换证书**，等签发完成后开关会自动可用；HTTPS 本身一直正常可用。
- 历史记录：证书刚签发时 Pages 配置是 `https_enforced: true`，`http://jiuhuweisi.me/` 返回 301 → `https://jiuhuweisi.me/`；`pages/health` 显示 `https_error: null` / `responds_to_https: true` / `is_https_eligible: true`。
- 之前排查时的「不安全 / Hostname mismatch」是**证书尚未签发阶段**的现象：当时服务端只发 `*.github.io` 通配证书。现在若浏览器仍提示不安全，优先清掉旧标签页与证书错误缓存（或本机代理 `127.0.0.1:56948` 的中间证书缓存），而不是改 DNS 或换证书。
- 站内没有任何 `http://` 子资源，外链全部 `https://`，不存在混合内容。本轮**未改 DNS、未删 CNAME、未替换证书、未手动切换 Enforce HTTPS**。

## 三个后续工具（规划，未创建仓库）

| 工具 | MVP | 可复用现有成果 |
| --- | --- | --- |
| VPS Health Check | 单点定时探测 + 状态页 + 异常通知，只读采集，不碰线上服务 | 现有只读巡检脚本、四端点探测与 PMTU 排查流程 |
| Agent Cost Tracker | 按模型/任务记 token 与费用，本地 CSV/SQLite + 简单图表 | 多模型实验记录、提示词工程模板 |
| Pixel Tavern Interaction Engine | 把 `tavern.ts` 的状态机、热区换算、帧控制器抽成独立小库 | 本站 `TavernLife` / `TavernFrames` / `layoutZones()` |

三者都只做设计评估，**没有创建空仓库、没有扩大公开范围、没有推送任何服务器代码或敏感配置**。要新建公共仓库前须先单独确认。
