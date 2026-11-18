/**
 * 酒馆伙伴数据。
 *
 * `art` 指向 public/images/ 下的透明背景像素立绘；留空会自动回退到占位卡。
 * 想换立绘：把新图放进 public/images/，改这里的路径即可，组件与链接逻辑都不用动。
 * `lines` 是点击卡片时随机抽取的台词，纯本地，不接任何 API。
 * `status` 只是卡片右上角的游戏风状态牌，可省略。
 */

export interface Companion {
  id: string;
  name: string;
  en: string;
  role: string;
  /** 立绘路径；留空 = 显示统一占位卡 */
  art?: string;
  /** 角色设定摘要，配合正式立绘展示 */
  setting: string;
  lines: string[];
  accent: 'lavender' | 'cyan';
  /** 卡片状态角标，例如 ON DUTY */
  status?: string;
}

export const companions: Companion[] = [
  {
    id: 'gpt-dragon',
    name: 'GPT 龙娘',
    en: 'DRAGON MAID',
    role: '酒馆管事 · 负责看店',
    art: '/images/companion-dragon.webp',
    setting: '白发紫瞳 · 龙角龙尾 · 今晚值班的酒馆管事',
    lines: [
      '欢迎回来，今晚想先翻哪份委托？',
      '吧台上的笔记本还热着，别偷看哦。',
      '……Zzz？啊，我只是在待机。',
      '灯我留着了，晚归的人也看得见路。',
      '热可可刚煮好，先坐一会儿吧。',
      '委托板整理过了，新贴的那张最有意思。',
      '打烊还早，慢慢逛就好。',
      '困是有点困，不过店还开着。',
    ],
    accent: 'lavender',
    status: 'ON DUTY',
  },
  {
    id: 'whale-ring',
    name: '鲸戒',
    en: 'WHALE RING',
    role: '聊天店员 · 负责陪聊',
    art: '/images/companion-whale.webp',
    setting: '蓝发 AI 少女 · 抱着饮料、半困摸鱼的聊天店员',
    lines: [
      '服务器没炸，只是猫踩到键盘了。',
      '新点子要趁热写下来，凉了就忘啦。',
      '要不要来一杯热可可？',
      'Zzz……没有在摸鱼，是在省电。',
      '黑板上的字是我写的，好看吧？',
      '今天只聊一点点，剩下的留给下次。',
      '小鲸鱼也在打哈欠了，你看。',
      '有好玩的事记得讲给我听呀。',
    ],
    accent: 'cyan',
    status: 'IDLE · Zzz',
  },
];
