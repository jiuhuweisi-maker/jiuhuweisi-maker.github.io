/** 站点级配置：品牌、导航、传送门。加平台只需往 socials 里加一项。 */

import type { IconName } from './icons';

export const site = {
  name: "Bistro's Tavern",
  domain: 'https://jiuhuweisi.me',
  title: "Bistro's Tavern · Bistro 的小酒馆",
  description:
    'Bistro 的像素风小酒馆：收留 AI 实验、代码、游戏和突然冒出来的奇怪想法。翻翻冒险委托板，点卡片就能直达真实项目。',
  owner: 'Bistro',
  locale: 'zh-CN',
  ogImage: '/images/og-cover.webp',
};

export interface NavItem {
  label: string;
  href: string;
  en: string;
}

export const navItems: NavItem[] = [
  { label: '首页', href: '#home', en: 'HOME' },
  { label: '委托板', href: '#quests', en: 'QUESTS' },
  { label: '店主档案', href: '#about', en: 'ABOUT' },
  { label: '酒馆伙伴', href: '#companions', en: 'PARTY' },
  { label: '传送门', href: '#portals', en: 'PORTAL' },
];

export interface SocialLink {
  id: string;
  label: string;
  handle: string;
  description: string;
  href: string;
  icon: IconName;
  accent: 'amber' | 'lavender' | 'cyan' | 'rose' | 'mint';
}

/** 只放真实存在的地址；没有的先别写进来。 */
export const socials: SocialLink[] = [
  {
    id: 'github',
    label: 'GitHub',
    handle: '@jiuhuweisi-maker',
    description: '公开仓库、代码和实验记录都在这里',
    href: 'https://github.com/jiuhuweisi-maker',
    icon: 'github',
    accent: 'amber',
  },
  {
    id: 'x',
    label: 'X',
    handle: '@WuBistro2',
    description: '一些日常碎碎念和新点子',
    href: 'https://x.com/WuBistro2',
    icon: 'x',
    accent: 'cyan',
  },
  {
    id: 'bilibili',
    label: 'Bilibili',
    handle: 'space.bilibili.com/405771812',
    description: '视频作品、AI 创作实验和游戏相关内容',
    href: 'https://space.bilibili.com/405771812',
    icon: 'tv',
    accent: 'rose',
  },
  {
    id: 'douyin',
    label: '抖音',
    handle: 'v.douyin.com/zbNtSOVVQrA',
    description: '短视频创作、游戏剪辑和其他个人作品',
    href: 'https://v.douyin.com/zbNtSOVVQrA/',
    icon: 'reel',
    accent: 'mint',
  },
];

export const interests: string[] = [
  'AI Explorer',
  'CS2',
  'Coding',
  'Anime',
  'Automation',
  'Digital Creator',
];
