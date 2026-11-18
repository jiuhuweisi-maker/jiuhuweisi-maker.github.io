/**
 * 冒险委托板数据 —— 网站唯一的项目清单。
 *
 * 以后添加项目：复制一个对象，填好字段即可，页面会自动多出一张卡。
 * 规则：
 *   - `url`  / `repo` 必须是真实可访问的地址；没有就留空（省略）。
 *     留空时卡片只展示介绍和状态，不会显示任何可点击的假按钮。
 *   - 不要编造成果、数据或完成状态；状态用 status 里的五种之一。
 *   - `icon` 取自 src/data/icons.ts，`category` 用于委托板筛选。
 *   - `detail` 是可选的「委托档案」：只写仓库 README / 描述里可核对的真实内容，
 *     字段缺失就自动隐藏，不要为了填满而编截图、Demo 或运行数据。
 */

import type { IconName } from './icons';

export type ProjectStatus = 'active' | 'wip' | 'experiment' | 'done' | 'unreleased';
export type ProjectCategory = 'robot' | 'ai' | 'video' | 'network' | 'unreleased';
export type ProjectAccent = 'amber' | 'lavender' | 'cyan' | 'rose' | 'mint';

/** 重点项目的可选档案。全部字段都可省略，缺什么就不显示什么。 */
export interface ProjectDetail {
  /** 档案里实际解决的问题 / 项目在做什么 */
  problem: string;
  /** 真实使用的技术，取自仓库说明 */
  stack?: string[];
  /** 当前开发状态的真实说明 */
  state?: string;
  /** 真实的方向 / 章节清单（例如实验室的九大方向） */
  areas?: string[];
  /** 真实可访问的分项链接（Demo、README、文档等） */
  links?: { label: string; href: string }[];
}

export interface Project {
  id: string;
  name: string;
  en: string;
  description: string;
  tags: string[];
  status: ProjectStatus;
  category: ProjectCategory;
  icon: IconName;
  accent: ProjectAccent;
  /** 卡片整体 + 「访问项目」按钮指向的真实地址；没有公开地址时省略 */
  url?: string;
  /** 真实 GitHub 仓库地址；省略则不显示 GitHub 按钮 */
  repo?: string;
  /** 卡片上钉的小纸条备注，可省略 */
  note?: string;
  /** 有真实内容时才填，会在委托板下方生成一张档案卡 */
  detail?: ProjectDetail;
}

export const STATUS_META: Record<ProjectStatus, { label: string; hint: string }> = {
  active: { label: '开发中', hint: '仍在持续更新' },
  wip: { label: '进行中', hint: '持续记录中' },
  experiment: { label: '实验中', hint: '可能会有变动' },
  done: { label: '已完成', hint: '成果可以查看' },
  unreleased: { label: '未公开', hint: '暂无公开链接' },
};

export const CATEGORY_META: { id: ProjectCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部委托' },
  { id: 'robot', label: 'QQ 机器人' },
  { id: 'ai', label: 'AI 实验室' },
  { id: 'video', label: '影像创作' },
  { id: 'network', label: '网络与站点' },
  { id: 'unreleased', label: '未公开' },
];

export const projects: Project[] = [
  {
    id: 'whale-ring',
    name: '鲸戒 · QQ AI 机器人',
    en: 'WHALE RING / QQ BOT',
    description:
      '拟人化 AI 聊天机器人的主仓库：从固定源码逐文件验指纹后构建完整运行源，包含精确回执、共用日记、按人物与会话检索，以及更新保护。私人记忆、角色与凭据都不入库。',
    tags: ['QQ', 'AI 聊天', 'DSH', '自动化'],
    status: 'active',
    category: 'robot',
    icon: 'whale',
    accent: 'cyan',
    url: 'https://github.com/jiuhuweisi-maker/qq-whale-girl-diary',
    repo: 'https://github.com/jiuhuweisi-maker/qq-whale-girl-diary',
    note: '店里的常驻招牌委托',
  },
  {
    id: 'dafeiyu-astrbot',
    name: '大肥鱼 · AstrBot 全家桶',
    en: 'DAFEIYU / ASTRBOT',
    description:
      'AstrBot + NapCat + 大模型的 QQ 机器人全家桶仓库，收录部署资料与踩坑合集。会看会听会说话的鲸鱼娘原型就藏在这里。',
    tags: ['AstrBot', 'NapCat', 'QQ Bot'],
    status: 'done',
    category: 'robot',
    icon: 'bot',
    accent: 'lavender',
    url: 'https://github.com/jiuhuweisi-maker/dafeiyu-astrbot',
    repo: 'https://github.com/jiuhuweisi-maker/dafeiyu-astrbot',
  },
  {
    id: 'dsh-prompt-kit',
    name: 'DSH Prompt Kit',
    en: 'PROMPT KIT',
    description:
      '给 AI Agent 用的结构化提示词模板：把「做个视频」拆成数据契约、视觉规格、渲染管线和验收清单，让想法能被稳定复现。',
    tags: ['Prompt', 'Agent', '模板'],
    status: 'done',
    category: 'ai',
    icon: 'scroll',
    accent: 'amber',
    url: 'https://github.com/jiuhuweisi-maker/dsh-prompt-kit',
    repo: 'https://github.com/jiuhuweisi-maker/dsh-prompt-kit',
  },
  {
    id: 'ai-automation-lab',
    name: 'AI 自动化实验室',
    en: 'AUTOMATION LAB',
    description:
      '记录我折腾 AI Agent、多模型协作、服务器自动化和各种 AI 创作工具的实验过程。成功的、翻车的，都留一点记录。',
    tags: ['AI Agent', 'Automation', 'Multi-Model'],
    status: 'wip',
    category: 'ai',
    icon: 'flask',
    accent: 'mint',
    url: 'https://github.com/jiuhuweisi-maker/ai-automation-lab',
    repo: 'https://github.com/jiuhuweisi-maker/ai-automation-lab',
    note: '九大方向 · 持续记录中',
    detail: {
      problem:
        '把散落在各个项目里的 AI 实践集中成一份能查证的记录：明确区分「已验证」「进行中」「待整理」，不把「用过」写成「验证过结果」。',
      stack: ['AI Agent 协作', '多模型 API', 'VPS 自动化', 'AI 视频剪辑', '提示词工程'],
      state: '仓库已公开（MIT），九大方向与编号实验持续补充中；这里只引用仓库里真实存在的条目。',
      areas: [
        '01 AI Agent 协作',
        '02 多模型与 API',
        '03 QQ 智能机器人',
        '04 VPS 自动化',
        '05 AI 网站开发',
        '06 AI 视频自动剪辑',
        '07 AI 图像与音乐',
        '08 社交平台自动化',
        '09 AI 工具与工作流',
      ],
      links: [
        { label: '仓库 README', href: 'https://github.com/jiuhuweisi-maker/ai-automation-lab#readme' },
      ],
    },
  },
  {
    id: 'ifish-v5',
    name: 'IFISH V5',
    en: 'AI FILM / CONCEPT',
    description:
      '83 秒 1080p60 概念短片：用 GPT 生成素材，配一套可复现的 2D 动态图形工程。一次把「AI 动画」做成完整片子的尝试。',
    tags: ['AI 动画', 'Motion Graphics', '短片'],
    status: 'done',
    category: 'video',
    icon: 'film',
    accent: 'rose',
    url: 'https://github.com/jiuhuweisi-maker/IFISH-v5',
    repo: 'https://github.com/jiuhuweisi-maker/IFISH-v5',
  },
  {
    id: 'cs2-skin-price-trend',
    name: 'CS2 饰品价格走势视频',
    en: 'CS2 / DATA MOTION',
    description:
      '把 CS2 饰品的真实历史价格做成 90 秒 1080p 动态走势视频：数据抓取、Canvas 渲染、ffmpeg 合成一条龙。',
    tags: ['CS2', '数据可视化', '视频'],
    status: 'done',
    category: 'video',
    icon: 'chart',
    accent: 'amber',
    url: 'https://github.com/jiuhuweisi-maker/cs2-skin-price-trend',
    repo: 'https://github.com/jiuhuweisi-maker/cs2-skin-price-trend',
    detail: {
      problem:
        '把两件 CS2 饰品的真实历史价格做成 90 秒 1080p 走势视频；数据来自 csgoskins.gg 的真实抓取值，仓库明确声明无模拟数据。',
      stack: ['Python', 'Canvas', 'ffmpeg', 'csgoskins.gg'],
      state: '成片 1920×1080 / 30fps / 90s，仓库内另有 skin-reveal 本地交互工作台。',
      links: [
        { label: '查看仓库', href: 'https://github.com/jiuhuweisi-maker/cs2-skin-price-trend' },
      ],
    },
  },
  {
    id: 'tun-postmortem',
    name: 'TUN 代理自环复盘',
    en: 'NETWORK POSTMORTEM',
    description:
      '一次移动端 TUN 客户端超时的完整排查复盘：缺少节点 IP 直连规则造成的自环。文档已脱敏公开，只留方法与结论。',
    tags: ['网络', 'TUN', '复盘'],
    status: 'done',
    category: 'network',
    icon: 'radar',
    accent: 'cyan',
    url: 'https://github.com/jiuhuweisi-maker/proxy-tun-loop-postmortem',
    repo: 'https://github.com/jiuhuweisi-maker/proxy-tun-loop-postmortem',
    detail: {
      problem:
        '同一份订阅、同一个节点，一端正常一端全超时；复盘定位到订阅规则缺少节点自身 IP 的 DIRECT，出站连接被 TUN 二次送回代理形成自环。',
      stack: ['mihomo / Clash.Meta', 'TUN', 'IP-CIDR,DIRECT', '规则顺序'],
      state: '复盘文档已脱敏公开，不含真实 IP、UUID、密钥或订阅令牌，只保留方法与结论。',
      links: [
        { label: '阅读复盘', href: 'https://github.com/jiuhuweisi-maker/proxy-tun-loop-postmortem' },
      ],
    },
  },
  {
    id: 'bistros-tavern',
    name: "Bistro's Tavern 本站",
    en: 'THIS VERY TAVERN',
    description:
      '你现在所在的这间小酒馆。Astro + TypeScript 手写像素风静态站，源码公开，托管在 GitHub Pages，用自定义域名访问。',
    tags: ['Astro', 'GitHub Pages', 'TypeScript'],
    status: 'active',
    category: 'network',
    icon: 'mug',
    accent: 'amber',
    url: 'https://github.com/jiuhuweisi-maker/jiuhuweisi-maker.github.io',
    repo: 'https://github.com/jiuhuweisi-maker/jiuhuweisi-maker.github.io',
    note: '你正站在里面',
  },
  {
    id: 'muse-x-lab',
    name: 'Muse & X 运营实验',
    en: 'BROWSER AGENT LAB',
    description:
      '围绕浏览器代理、社交平台运营与 VPS Bridge 的技术实验。这里只记公开、安全的思路，不涉及账号凭据或内部接口；暂未开放仓库。',
    tags: ['浏览器代理', 'X 运营实验', 'VPS Bridge'],
    status: 'unreleased',
    category: 'unreleased',
    icon: 'shield',
    accent: 'lavender',
  },
];
