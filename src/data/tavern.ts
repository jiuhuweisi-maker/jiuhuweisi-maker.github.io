/**
 * Bistro's Tavern V1.2 — 动态酒馆的集中配置。
 *
 * 这里只放「内容」：角色台词、联动剧情、点击热区、音乐参数、素材需求。
 * 所有运行时逻辑在 src/scripts/tavern.ts，以后加台词 / 加剧情 / 调热区都只改本文件。
 *
 * 热区坐标是相对**原始头图画布**（tavern-hero.webp, 1600×901）的归一化比例，
 * 与屏幕尺寸无关；运行时会按 object-fit: cover 的实际绘制矩形换算（见 layoutActors）。
 */

export type ActorId = 'dragon' | 'whale' | 'cat';

/* ------------------------------------------------------------------ *
 * 1. 三位角色
 * ------------------------------------------------------------------ */

export interface ActorLine {
  text: string;
  /** 对话框右上角的小状态牌，例如 ON DUTY / AWAKE；省略则不显示 */
  mood?: string;
}

export interface ActorConfig {
  id: ActorId;
  name: string;
  en: string;
  role: string;
  /** 热区：相对原图画布的 x / y / w / h，取值 0–1 */
  zone: { x: number; y: number; w: number; h: number };
  /** 默认状态牌 */
  status: string;
  /** 普通点击时随机抽取的台词（不会连续重复） */
  lines: ActorLine[];
}

export const ACTORS: ActorConfig[] = [
  {
    id: 'dragon',
    name: 'GPT 龙娘',
    en: 'DRAGON MAID',
    role: '酒馆管理员 · 今晚看店',
    zone: { x: 0.215, y: 0.15, w: 0.315, h: 0.72 },
    status: 'ON DUTY',
    lines: [
      { text: "欢迎来到 Bistro's Tavern，今天想喝点什么？", mood: 'GREETING' },
      { text: '杂鱼店主，又来检查我的工作了？', mood: 'SMUG' },
      { text: '……Zzz？我才没有睡着！', mood: 'SLEEPY' },
      { text: '新的冒险委托？交给我看看。', mood: 'ON DUTY' },
      { text: '鲸戒！别在营业时间睡觉啦！', mood: 'SCOLD' },
      { text: '热可可刚煮好，先坐一会儿吧。', mood: 'RELAXED' },
      { text: '灯我留着了，晚归的人也看得见路。', mood: 'RELAXED' },
      { text: '账本我理好了，别让猫踩上去。', mood: 'ON DUTY' },
    ],
  },
  {
    id: 'whale',
    name: '鲸戒',
    en: 'WHALE RING',
    role: '聊天担当 · 正在摸鱼',
    zone: { x: 0.605, y: 0.395, w: 0.335, h: 0.395 },
    status: 'SLEEPING',
    lines: [
      { text: '我没有摸鱼，只是在节能模式！', mood: 'AWAKE' },
      { text: '要不要来一杯热可可？', mood: 'AWAKE' },
      { text: 'GPT 姐姐又在偷偷卷了……', mood: 'AWAKE' },
      { text: '再让我睡五分钟嘛！', mood: 'SLEEPY' },
      { text: '今天的酒馆也很热闹呢。', mood: 'AWAKE' },
      { text: '黑板上的字是我写的，好看吧？', mood: 'AWAKE' },
      { text: '服务器没炸，只是猫踩到键盘了。', mood: 'AWAKE' },
    ],
  },
  {
    id: 'cat',
    name: '吧台的猫',
    en: 'TAVERN CAT',
    role: '酒馆吉祥物 · 默认打盹',
    zone: { x: 0.605, y: 0.805, w: 0.205, h: 0.185 },
    status: 'NAP TIME',
    lines: [
      { text: '喵～', mood: '喵' },
      { text: '喵。（尾巴轻轻扫过桌面）', mood: '喵' },
      { text: '喵呜……（翻了个身）', mood: 'Zzz' },
      { text: '吧台上的猫：「喵。」（它把爪子搭在了键盘上）', mood: '喵' },
      { text: '喵！它假装什么都没做。', mood: '喵' },
    ],
  },
];

/** 鲸戒第一次被点名时的专属「被叫醒」台词 */
export const WHALE_WAKE_LINES: ActorLine[] = [
  { text: '唔……谁叫我？', mood: 'WAKING UP' },
  { text: 'Zzz……啊！我、我在值班！', mood: 'WAKING UP' },
  { text: '五分钟……再给我五分钟就好……', mood: 'WAKING UP' },
];

/** 猫咪连续点击时的特殊反应（不会无限叠加） */
export const CAT_COMBO_LINES: ActorLine[] = [
  { text: '喵呜——！（它伸了个懒腰，又趴回去了）', mood: 'STRETCH' },
  { text: '喵？？（耳朵竖了起来，盯着你看）', mood: 'ALERT' },
  { text: '……喵。它决定继续睡。', mood: 'NAP TIME' },
];

/* ------------------------------------------------------------------ *
 * 2. 联动剧情（轻量级状态机的数据部分）
 * ------------------------------------------------------------------ */

export interface StoryBeat {
  actor: ActorId | 'narrator';
  text: string;
  mood?: string;
}

export interface Story {
  id: string;
  title: string;
  beats: StoryBeat[];
  /** 隐藏事件：只能由连续互动解锁，不进入随机池 */
  hidden?: boolean;
  /** 播放时把酒馆灯光调暗 */
  closing?: boolean;
}

export const STORIES: Story[] = [
  {
    id: 'wake-whale',
    title: '事件 A · 叫醒鲸戒',
    beats: [
      { actor: 'narrator', text: '吧台后的小钟轻轻响了一声。' },
      { actor: 'dragon', text: '鲸戒，轮到你值班了。', mood: 'ON DUTY' },
      { actor: 'whale', text: 'Zzz……我已经在梦里上班了。', mood: 'SLEEPING' },
      { actor: 'cat', text: '喵！', mood: '喵' },
      { actor: 'narrator', text: '鲸戒把脸埋回手臂，尾巴却先醒了。' },
    ],
  },
  {
    id: 'cat-sips',
    title: '事件 B · 猫咪偷喝',
    beats: [
      { actor: 'narrator', text: '白灰色的小猫悄悄靠近了桌上的杯子。' },
      { actor: 'dragon', text: '等等！那个不能喝！', mood: 'SURPRISED' },
      { actor: 'whale', text: '诶？我的奶昔呢？！', mood: 'AWAKE' },
      { actor: 'cat', text: '喵。（若无其事地收回爪子）', mood: '喵' },
    ],
  },
  {
    id: 'slacking',
    title: '事件 C · 偷偷摸鱼',
    beats: [
      { actor: 'dragon', text: '你今天的工作做完了吗？', mood: 'SMUG' },
      { actor: 'whale', text: '我在思考人生，这也是工作！', mood: 'AWAKE' },
      { actor: 'narrator', text: '黑板上的待办清单，悄悄多了一个勾。' },
    ],
  },
  {
    id: 'cat-mischief',
    title: '事件 D · 猫咪捣乱',
    beats: [
      { actor: 'narrator', text: '猫咪一跃上桌，爪子按住了账本。' },
      { actor: 'dragon', text: '喂！我的账本！', mood: 'SURPRISED' },
      { actor: 'whale', text: '哈哈哈哈，这下有人比我还能闹了！', mood: 'AWAKE' },
      { actor: 'cat', text: '喵。', mood: '喵' },
    ],
  },
  {
    id: 'last-call',
    title: '事件 E · 深夜打烊',
    closing: true,
    beats: [
      { actor: 'narrator', text: '吊灯的光慢慢暗了一点。' },
      { actor: 'dragon', text: '今天也辛苦了，晚安。', mood: 'RELAXED' },
      { actor: 'whale', text: '终于可以睡觉啦……', mood: 'SLEEPY' },
      { actor: 'cat', text: '喵呜～', mood: 'Zzz' },
      { actor: 'narrator', text: '招牌还亮着，留给下一个晚归的人。' },
    ],
  },
  {
    id: 'regular',
    title: '★ 隐藏事件 · 熟客',
    hidden: true,
    beats: [
      { actor: 'narrator', text: '你连着敲了敲吧台，三个小家伙同时抬起头。' },
      { actor: 'dragon', text: '……客人，你今天很有精神嘛。', mood: 'SMUG' },
      { actor: 'whale', text: '是、是有隐藏菜单吗？', mood: 'AWAKE' },
      { actor: 'cat', text: '喵～♪', mood: '喵' },
      { actor: 'narrator', text: '★ 解锁：今晚的酒馆，记得你来了。' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * 3. 交互节奏参数
 * ------------------------------------------------------------------ */

export const TIMING = {
  /** 单句台词停留 */
  lineHold: 5200,
  /** 剧情每句停留 */
  beatHold: 3600,
  /** 剧情冷却（毫秒）；冷却内不会再触发 */
  storyCooldown: 26000,
  /** 点击触发联动剧情的概率（刻意压低，默认不打断普通对话） */
  storyChance: 0.07,
  /** 至少先和角色聊这么多次，才允许随机剧情，避免第一次点击就进长剧情 */
  storyMinInteractions: 8,
  /** 隐藏事件解锁后，每次点击的触发概率 */
  hiddenStoryChance: 0.3,
  /** 连续互动多少次解锁隐藏事件 */
  comboUnlock: 7,
  /** 连续互动的判定窗口 */
  comboWindow: 14000,
  /** 猫咪连点特殊反应阈值 */
  catCombo: 3,
  /** 猫咪连点判定窗口 */
  catComboWindow: 2600,
  /** 鲸戒清醒多久后重新睡着 */
  whaleAwakeMs: 28000,
  /** 角色动画/状态复位的兜底时间 */
  stateResetMs: 2400,
} as const;

/* ------------------------------------------------------------------ *
 * 4. 正式背景音乐（唯一指定曲目，不替换、不生成替代音乐）
 * ------------------------------------------------------------------ */

/**
 * 实测（ffprobe + 电平包络分析，2026-11-18）：
 *   文件 184.405s / 48kHz 立体声 / 320kbps / 7.1MB。
 *   开头 0.00–0.10s 近乎静音，0.10s 后进入，0.55s 到正常电平（约 -11dB）。
 *   音乐从约 180.5s 开始渐弱，182.25s 后低于 -45dB，
 *   182.93–184.41s 是 1.48 秒**纯数字静音**（不是音乐尾声）。
 *   因此直接 loop=true 会出现「渐弱 → 1.5 秒空白 → 突然起音」的断裂。
 *
 * 处理：设置循环区间 0.08s → 182.35s（完整保留渐弱尾声，只跳过尾部纯静音），
 * 并在区间末端做 1.2 秒双实例交叉淡化 —— 曲子本身就是「渐弱收尾 + 0.5s 渐入起头」，
 * 重叠压在 1.2s 而不是更长，既消除接缝又不会把新一遍的开头糊成一团。
 * A 实例完整播到 182.35s，一帧都没截掉；原文件也没有重新编码。
 */
export const BGM = {
  src: '/audio/moonlight-at-bistros-tavern.mp3',
  title: "Moonlight at Bistro's Tavern",
  subtitle: 'Bistro\'s Tavern · 专属 BGM',
  loopIn: 0.08,
  loopOut: 182.35,
  crossfade: 1.2,
  fadeIn: 1.0,
  fadeOut: 1.0,
  defaultVolume: 0.18,
} as const;

/* ------------------------------------------------------------------ *
 * 5. 真实角色动作：素材需求（B 类效果）
 * ------------------------------------------------------------------ *
 *
 * 现状核查（2026-11-18）：头图 tavern-hero.webp / tavern-hero-sm.webp 是**一张合成图**，
 * 仓库里没有任何角色独立透明图层或逐帧图。companion-dragon.webp / companion-whale.webp
 * 是另一套「全身站姿立绘」，姿态与头图（坐姿 / 趴睡）完全不同，不能贴回头图当动作帧，
 * 否则会破坏构图与像素网格。
 *
 * 所以：眨眼、表情变化、转头、抬头、伸懒腰这类「真实动作」本轮**没有实现**，
 * 也绝不用 CSS 局部扭曲整张图去假装人物在动。本轮交付的是 A 类效果：
 * 点击热区 / RPG 对话框 / 状态牌 / 光效 / Zzz / 环境粒子 / 状态机。
 *
 * 下面是要真正做 B 类效果时需要的素材清单。拿到素材后只需把文件放进 public/images/frames/，
 * 在 FRAME_ASSETS 里填帧数组即可启用，运行时已预留帧图层渲染器（renderFrameLayers）。
 * 规格：
 *   - 与 tavern-hero.webp **完全同尺寸 1600×901**、同一像素网格、RGBA 透明背景；
 *   - 每帧只画该角色对应的 bbox 区域，其余全透明，作为覆盖层叠在原图上；
 *   - 每帧的绘制必须与原图该位置的像素边界严格对齐（不要抗锯齿 / 不要缩放）；
 *   - 建议 WebP（有损质量 90+ 或无损）或 PNG-8/32，单帧控制在 150KB 内；
 *   - 手机端用同一张图按比例缩放，无需第二套。
 *
 * 需要的具体帧（每个角色一套）：
 *   dragon  bbox x .20–.54 / y .12–.56（头 + 肩）
 *     dragon-idle.png, dragon-blink-a.png, dragon-blink-b.png,
 *     dragon-look.png（看向访客）, dragon-smile.png, dragon-sleepy.png
 *   whale   bbox x .60–.95 / y .38–.80（头 + 手臂）
 *     whale-sleep.png, whale-breath.png, whale-wake-a.png, whale-wake-b.png,
 *     whale-awake.png, whale-blink.png, whale-head-up.png
 *   cat     bbox x .60–.82 / y .79–1.00
 *     cat-rest.png, cat-blink.png, cat-ear-twitch.png, cat-head-up.png,
 *     cat-stretch-a.png, cat-stretch-b.png, cat-stretch-c.png
 *   另需：一张 tavern-plate.png（把三位角色从原图里抠掉后的「空吧台」底图），
 *   否则覆盖层无法做「闭眼 → 睁眼」这种替换（原图里眼睛一直睁着）。
 *   这是最关键的一块：没有去角色的底图，只能做叠加，不能做替换。
 *
 * 有了 tavern-plate.png + 逐帧图层后，帧动画的正确顺序是：
 *   底图 → 三个角色当前帧 → 前景猫当前帧 → 光效层。
 */

export interface FrameLayer {
  actor: ActorId | 'plate';
  /** 帧序列；空数组 = 未启用 */
  frames: string[];
  /** 帧停留毫秒 */
  frameMs: number;
}

/** 全部留空 = B 类效果未启用。填入路径即自动启用，不需要改运行时代码。 */
export const FRAME_ASSETS: FrameLayer[] = [
  { actor: 'plate', frames: [], frameMs: 0 },
  { actor: 'dragon', frames: [], frameMs: 140 },
  { actor: 'whale', frames: [], frameMs: 180 },
  { actor: 'cat', frames: [], frameMs: 160 },
];
