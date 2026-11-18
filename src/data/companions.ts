/**
 * 酒馆伙伴占位数据。
 *
 * 正式立绘到位后：把 `art` 改成图片路径（放在 public/images/ 下），
 * 组件会自动改用图片；现在统一显示像素占位卡，不预设角色长相。
 * `lines` 是点击卡片轮换的台词，纯本地，不接任何 API。
 */

export interface Companion {
  id: string;
  name: string;
  en: string;
  role: string;
  /** 立绘路径；留空 = 显示统一占位卡 */
  art?: string;
  /** 来自店主已公开的设定，仅文字，不画具体形象 */
  setting: string;
  lines: string[];
  accent: 'lavender' | 'cyan';
}

export const companions: Companion[] = [
  {
    id: 'gpt-dragon',
    name: 'GPT 龙娘',
    en: 'DRAGON MAID',
    role: '酒馆常驻 · 负责看店',
    setting: '设定已定：日系龙娘少女，以正式立绘为准',
    lines: [
      '欢迎回来，今晚想先翻哪份委托？',
      '吧台上的笔记本还热着，别偷看哦。',
      '……Zzz？啊，我只是在待机。',
    ],
    accent: 'lavender',
  },
  {
    id: 'whale-ring',
    name: '鲸戒',
    en: 'WHALE RING',
    role: '酒馆常驻 · 负责聊天',
    setting: '设定已定：蓝发 AI 少女，以正式立绘为准',
    lines: [
      '服务器没炸，只是猫踩到键盘了。',
      '新点子要趁热写下来，凉了就忘啦。',
      '要不要来一杯热可可？',
    ],
    accent: 'cyan',
  },
];
