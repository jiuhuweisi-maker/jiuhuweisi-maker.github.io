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

推送到 `main` 会自动触发 `.github/workflows/deploy.yml`：安装依赖 → 构建 → 上传 artifact → 发布到 GitHub Pages。

`public/CNAME` 必须保留内容为 `jiuhuweisi.me`，否则自定义域名会被清掉。仓库根目录的 `CNAME` 也保留，兼容旧配置。

## 添加 / 修改项目

只改 `src/data/projects.ts` 里的 `projects` 数组即可，页面会自动多出一张卡：

- 有真实地址：填 `url`（卡片整体点击 + 「访问项目」按钮）与 `repo`（GitHub 按钮）。
- 没有公开地址：省略 `url` / `repo`，卡片只显示介绍、状态和「暂无公开链接」，不会出现假按钮。
- `category` 决定委托板筛选分组，`status` 取 `active` / `experiment` / `done` / `unreleased`。
- `icon` 用 `src/data/icons.ts` 里的 12×12 像素精灵名；新精灵也加在那一处，构建时会自动校验尺寸。

## 其他配置

- 传送门平台：`src/data/site.ts` 的 `socials`，只放真实存在的地址。
- 酒馆伙伴：`src/data/companions.ts`，给角色加 `art`（`public/images/` 下的路径）即可把占位卡换成正式立绘；`lines` 是点击轮换的台词。
- 首屏插画：`public/images/tavern-hero.webp`（桌面）与 `tavern-hero-sm.webp`（手机），`og-cover.webp` 是分享图。首屏主视觉用 eager 保证加载速度，角色立绘等其余图片用 lazy。
