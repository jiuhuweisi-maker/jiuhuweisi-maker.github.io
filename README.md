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

仓库根目录的 `deploy-workflow.yml` 是 GitHub Actions 自动构建配置（启用后放到 `.github/workflows/deploy.yml`）：安装依赖 → 构建 → 上传 artifact → 发布到 GitHub Pages。**当前实际发布方式见下方「当前部署状态」**。

`public/CNAME` 必须保留内容为 `jiuhuweisi.me`，否则自定义域名会被清掉。仓库根目录的 `CNAME` 也保留，兼容旧配置。

## 添加 / 修改项目

只改 `src/data/projects.ts` 里的 `projects` 数组即可，页面会自动多出一张卡：

- 有真实地址：填 `url`（卡片整体点击 + 「访问项目」按钮）与 `repo`（GitHub 按钮）。
- 没有公开地址：省略 `url` / `repo`，卡片只显示介绍、状态和「暂无公开链接」，不会出现假按钮。
- `category` 决定委托板筛选分组，`status` 取 `active` / `experiment` / `done` / `unreleased`。
- `icon` 用 `src/data/icons.ts` 里的 12×12 像素精灵名；新精灵也加在那一处，构建时会自动校验尺寸。

## 其他配置

- 传送门平台：`src/data/site.ts` 的 `socials`，只放真实存在的地址。
- 酒馆伙伴：`src/data/companions.ts`。`art` 指向 `public/images/` 下的**透明背景** WebP 立绘（当前为 `companion-dragon.webp` / `companion-whale.webp`），留空自动回退到问号占位卡；`lines` 是点击卡片时随机抽取的台词，`status` 是右上角状态牌。换立绘只改路径，不用动组件。
- 首屏插画：`public/images/tavern-hero.webp`（桌面）与 `tavern-hero-sm.webp`（手机），`og-cover.webp` 是分享图。首屏主视觉用 eager 保证加载速度，角色立绘等其余图片用 lazy。
- 头图动效：`src/components/Hero.astro` 里的 `.scene-fx` 是覆盖在原插画上的轻量图层（6 处暖灯光晕、月亮呼吸光、Zzz 上浮、桌面高光），`src/layouts/BaseLayout.astro` 负责生成 20 余颗随机星点并做 ±3px 鼠标视差，样式与 keyframes 在 `src/styles/global.css` 的 `living tavern scene` 段。没有视频、没有新依赖；`prefers-reduced-motion: reduce` 下星点不生成、Zzz 隐藏、所有动画停用，只保留静态柔光。手机端头图被裁成正方形，`.scene-fx` 在 640px 断点下用 `177.6%` 宽度对齐原始 16:9 画布坐标，改灯位时记得同时看手机截图。
- V1.2 新增 `.scene-motes`（12 个随机环境光点）、`.actor-zones`（三角色热区）、`.tavern-dialogue`（视口底部 RPG 对话框）、`.tavern-player`（左下角点唱机），见下一节。

## V1.2 · 动态酒馆

**所有内容集中在一个文件：`src/data/tavern.ts`** —— 三角色台词池、五组联动剧情 + 隐藏事件、热区坐标（相对原图 1600×901 的归一化比例）、交互节奏、`BGM` 参数、逐帧素材清单。运行时逻辑全部在 `src/scripts/tavern.ts`（由 `BaseLayout.astro` 的 `<script>` 打包，无任何第三方依赖）。

- **热区**：`ACTORS[].zone` 是归一化坐标，`layoutZones()` 会读取 `object-fit: cover` / `object-position` 的真实绘制矩形换算成像素，并在 resize 与图片 load 后重算。手机端头图被裁成正方形也能对齐；改插画比例后只需改 zone，不用改代码。
- **对话框**：固定在视口底部（`TavernDialogue.astro`），不遮挡插画人物、不产生布局偏移；普通台词 5.2s 自动收起。剧情按 beat 链式播放（3.6s/句），点角色可快进下一句，右上角「跳过 ▶」或 Esc 可结束；剧情冷却 26s，前 8 次点击不会触发，默认概率 7%。
- **鲸戒**：默认睡觉，首次点击从 `WHALE_WAKE_LINES` 抽「被叫醒」台词并收起叠加 Zzz，28s 无互动自动睡回去。猫咪 2.6s 内连点 3 次触发 `CAT_COMBO_LINES`，触发后计数清零，不会无限叠动画。
- **BGM**：唯一指定曲目 `public/audio/moonlight-at-bistros-tavern.mp3`（184.4s / 320kbps / 7.1MB）。实测尾部 182.93–184.41s 是纯数字静音、音乐在 182.35s 已渐弱结束，所以循环区间设为 `0.08s → 182.35s`，末端 1.2s 用双 `HTMLAudioElement` 交叉淡化；**没有截掉音乐尾声，也没有重新编码原文件**，不用浏览器原生 `loop`（会把 1.5s 空白带回来）。
- **播放器**：`TavernPlayer.astro`，默认**收起**成一个小音符按钮（避免挡住头图，尤其手机端）。播放/暂停、音量、静音、循环、角色音效开关、收起状态写入 `localStorage` 的 `tavern.audio.v1`；默认音量 18%、循环开、音效关、不自动播放。音频用 `preload="metadata"` 且只在首次点击时创建实例，首屏不下载 7MB。渐入/渐出 1s，角色音效开启时 BGM 短暂降到 32%；页面切到后台自动暂停音轨与动画，回来恢复。
- **真实动作素材（未完成）**：头图是单张合成图，没有角色独立透明图层或逐帧图，`companion-*.webp` 是另一套全身站姿立绘，姿态不同不能贴回去。因此眨眼、表情变化、转头、抬头、伸懒腰这类 B 类效果**没有实现**，也没有用 CSS 局部扭曲整张图去假装人物在动。需要的具体帧清单写在 `src/data/tavern.ts` 第 5 节；把素材放进 `public/images/frames/` 并填入 `FRAME_ASSETS` 就会自动启用已写好的帧图层渲染器（最关键的一张是抠掉三位角色的 `tavern-plate.png` 底图）。
- 原图自带的白色 `Zzz` 气泡属于插画美术，无法在鲸戒醒来时单独隐藏；隐藏的只是叠加的暖金小 `z` 图层。

## 当前部署状态（V1）

站点由 GitHub Pages 从 `main` 分支的 `/docs` 目录静态发布；`docs/.nojekyll` 用来关掉 Jekyll，保证 `_astro/` 里的 CSS 与字体不被吞掉。`public/CNAME`、`docs/CNAME` 与仓库根目录 `CNAME` 都保留 `jiuhuweisi.me`。

改完源码后更新线上：

```bash
npm run build
rm -rf docs && cp -r dist docs && touch docs/.nojekyll
git add -A && git commit -m "Update site" && git push origin main
```

`.github/workflows/deploy.yml` 的等价配置保存在仓库根目录的 `deploy-workflow.yml`。当前 GitHub CLI 的 OAuth token 缺少 `workflow` scope，无法直接推送到 `.github/workflows/`，所以 V1 暂用上面的 docs 静态发布。授权后切换到 Actions 自动构建：

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows && cp deploy-workflow.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml && git commit -m "Enable Actions deploy" && git push origin main
```

然后在仓库 **Settings → Pages → Build and deployment** 把 Source 改成 **GitHub Actions**，之后每次 push 到 main 都会自动构建部署。
