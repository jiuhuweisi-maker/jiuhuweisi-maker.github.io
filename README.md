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
