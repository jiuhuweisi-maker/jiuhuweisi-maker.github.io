/**
 * Bistro's Tavern V1.2 — 「活着的酒馆」统一运行时（V1.3 增量：真实动作帧）。
 *
 * 一个模块同时管四件事，共享同一个 reduced-motion / visibility 开关：
 *   1. TavernAudio：正式 BGM（双实例交叉淡化循环）+ 可选角色音效 + 偏好持久化
 *   2. TavernLife ：三角色热区、RPG 对话框、独立状态、五组联动剧情（有限状态机）
 *   3. 环境层    ：光点、打烊灯光、Zzz 与睡眠联动
 *   4. TavernFrames：状态驱动的透明帧控制器（只播放逐帧复核通过的素材）
 *
 * 所有内容（台词、剧情、热区、音乐参数、素材清单）都在 src/data/tavern.ts。
 * 本文件不 import 任何第三方库，也不改动原有交互脚本。
 */

import {
  ACTORS,
  WHALE_WAKE_LINES,
  CAT_COMBO_LINES,
  STORIES,
  TIMING,
  BGM,
  FRAME_ASSETS,
  type ActorId,
  type ActorLine,
  type Story,
} from '../data/tavern';
import { TavernVideoManager } from './tavern-video';
import { initUiFeedback } from './ui-feedback';

/** V1.5 统一视频管理器（模块级单例：与 TavernLife 共享点击通知，不改其状态机） */
let videoManager: TavernVideoManager | null = null;

/* ------------------------------------------------------------------ *
 * 0. 小工具
 * ------------------------------------------------------------------ */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function one<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}
function many<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** 全局定时器登记：页面隐藏 / 跳过剧情 / 状态复位时统一清理，杜绝动画竞争 */
const timers = new Set<number>();
function later(fn: () => void, ms: number): number {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}
function cancel(id: number | null): null {
  if (id !== null) {
    window.clearTimeout(id);
    timers.delete(id);
  }
  return null;
}

function pick<T>(pool: T[], avoid = -1): { item: T; index: number } {
  if (!pool.length) return { item: undefined as unknown as T, index: -1 };
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === avoid) i = (i + 1) % pool.length;
  return { item: pool[i], index: i };
}

/* ------------------------------------------------------------------ *
 * 1. 音频系统
 *
 * 循环策略（已用 ffprobe + 电平包络实测，见 tavern.ts 注释）：
 *   尾部 182.93–184.41s 是纯数字静音；音乐在 182.35s 已渐弱结束。
 *   于是 A 实例完整播到 loopOut，末端 1.2s 让 B 实例从 loopIn 淡入，
 *   到 loopOut 时切主实例。没有截掉尾声，也没有重新编码文件。
 * ------------------------------------------------------------------ */

interface AudioPrefs {
  volume: number;
  muted: boolean;
  loop: boolean;
  sfx: boolean;
  collapsed: boolean;
}

const PREFS_KEY = 'tavern.audio.v1';
const DEFAULT_PREFS: AudioPrefs = {
  volume: BGM.defaultVolume,
  muted: false,
  loop: true,
  sfx: true, // V1.3：角色音效默认开启（220ms 节流 + 独立增益，不叠音）
  collapsed: true, // 默认收起成一个小音符，避免挡住头图（尤其手机端）
};

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const saved = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      volume: clamp(Number(saved.volume ?? DEFAULT_PREFS.volume)),
      muted: !!saved.muted,
      loop: saved.loop !== false,
      sfx: !!saved.sfx,
      collapsed: !!saved.collapsed,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

class TavernAudio {
  prefs = loadPrefs();
  /** 全站唯一的音轨集合：任何 BGM 音轨都必须登记在这里，暂停/静音/音量一律遍历它 */
  private voices = new Set<HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;
  private incoming: HTMLAudioElement | null = null;
  private starting = false;
  private switchFailed = false;
  private gesture: (() => void) | null = null;
  private master = 0;
  private masterTarget = 0;
  private duck = 1;
  private playing = false;
  private finished = false;
  private hiddenWasPlaying = false;
  private raf = 0;
  private lastFrame = 0;
  private ctx: AudioContext | null = null;
  private lastSfxAt = 0;
  private duckTimer: number | null = null;
  private stopTimer: number | null = null;

  constructor(private ui: HTMLElement | null) {
    this.bindUI();
    this.syncUI();
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.teardown());
  }

  private save(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* 隐私模式下写不进 localStorage，忽略即可，功能不受影响 */
    }
  }

  private status(message: string): void {
    const el = one('[data-player-status]', this.ui ?? document);
    if (el) el.textContent = message;
  }

  private makeVoice(): HTMLAudioElement {
    const a = new Audio();
    a.src = BGM.src;
    a.preload = 'metadata';
    a.loop = false; // 循环由状态机精确控制，不用浏览器原生 loop（会带回 1.48s 静音）
    a.volume = 0;
    a.dataset.tavernVoice = '';
    a.setAttribute('aria-hidden', 'true');
    // 挂进播放器容器（无 controls，不渲染），便于统一暂停 / 检查 / 生命周期管理
    this.voices.add(a);
    this.ui?.appendChild(a);
    a.addEventListener('error', () => this.status('音频加载失败，请刷新后重试'));
    return a;
  }

  /** 在用户手势里启动一个实例；seek 到 at 需要 metadata 就绪 */
  private startVoice(a: HTMLAudioElement, at: number): Promise<boolean> {
    return new Promise((resolve) => {
      const go = () => {
        try {
          if (a.readyState >= 1) a.currentTime = at;
        } catch {
          /* 某些浏览器在 seekable 未就绪时抛错，忽略后从头播放即可 */
        }
        a.volume = 0;
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => resolve(true)).catch(() => resolve(false));
        } else {
          resolve(true);
        }
      };
      if (a.readyState >= 1) go();
      else {
        let settled = false;
        a.addEventListener('loadedmetadata', () => {
          if (settled) return;
          settled = true;
          go();
        }, { once: true });
        a.load();
        window.setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }, 9000);
      }
    });
  }

  private baseVolume(): number {
    return this.prefs.muted ? 0 : clamp(this.prefs.volume) * this.master * this.duck;
  }

  /** rAF 驱动：渐入渐出、交叉淡化、ducking 全走同一条包络，避免爆音 */
  private tick = (now: number): void => {
    const dt = this.lastFrame ? Math.min(64, now - this.lastFrame) : 16;
    this.lastFrame = now;

    const span = (this.masterTarget > this.master ? BGM.fadeIn : BGM.fadeOut) * 1000;
    const step = dt / Math.max(1, span);
    if (this.master < this.masterTarget) this.master = Math.min(this.masterTarget, this.master + step);
    else if (this.master > this.masterTarget) this.master = Math.max(this.masterTarget, this.master - step);

    const base = this.baseVolume();
    const a = this.current;
    if (a && !a.paused && (this.playing || this.master > 0.002)) {
      const t = a.currentTime;
      if (this.incoming) {
        const p = clamp((t - (BGM.loopOut - BGM.crossfade)) / BGM.crossfade);
        a.volume = clamp(base * (1 - p));
        this.incoming.volume = clamp(base * p);
        if (p >= 1 || t >= BGM.loopOut) this.finishSwitch();
      } else {
        a.volume = clamp(base);
        if (this.prefs.loop && !this.switchFailed && t >= BGM.loopOut - BGM.crossfade) void this.beginSwitch();
        else if (!this.prefs.loop && t >= BGM.loopOut && this.playing) this.finishPlayback();
      }
    } else if (!this.incoming) {
      for (const v of this.voices) v.volume = 0;
    }
    // 不在 current / incoming 名下的音轨一律静音并暂停：杜绝「关不掉的第二条 BGM」
    for (const v of this.voices) {
      if (v !== this.current && v !== this.incoming) {
        v.pause();
        v.volume = 0;
      }
    }

    if (this.playing || this.master > 0.002) this.raf = requestAnimationFrame(this.tick);
    else {
      this.raf = 0;
      this.lastFrame = 0;
      if (!this.playing) {
        for (const v of this.voices) {
          v.pause();
          v.volume = 0;
        }
      }
    }
  };

  private startRaf(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private async beginSwitch(): Promise<void> {
    if (this.incoming || !this.current) return;
    // 下一遍从曲首开始；与当前实例的渐弱尾声重叠 crossfade 秒
    const b = this.makeVoice();
    this.incoming = b;
    const ok = await this.startVoice(b, BGM.loopIn);
    if (!ok || this.incoming !== b) {
      this.dropVoice(b);
      if (this.incoming === b) this.incoming = null;
      // 冷却：被拦截时不能每帧重建音轨（这正是「二重奏 / 多重奏」的来源）
      this.switchFailed = true;
      this.status('循环切换被拦截，点一次播放即可恢复');
      return;
    }
    b.volume = 0;
  }

  private finishSwitch(): void {
    const old = this.current;
    const next = this.incoming;
    if (!next) return;
    if (old) this.dropVoice(old);
    this.current = next;
    this.incoming = null;
    this.switchFailed = false;
    next.volume = clamp(this.baseVolume());
  }

  /** 唯一的音轨销毁入口，保证没有任何音轨脱离管理器 */
  private dropVoice(a: HTMLAudioElement): void {
    a.pause();
    a.volume = 0;
    try { a.currentTime = 0; } catch { /* seek 未就绪时忽略 */ }
    a.remove();
    this.voices.delete(a);
  }

  /** 立即把音量/静音/暂停状态同步到全部音轨，不等下一帧 */
  private forceApply(): void {
    const base = this.baseVolume();
    for (const v of this.voices) {
      if (v === this.current && !this.incoming) v.volume = clamp(base);
      else if (v !== this.current && v !== this.incoming) {
        v.pause();
        v.volume = 0;
      }
    }
    this.startRaf();
  }

  private finishPlayback(): void {
    this.playing = false;
    this.finished = true;
    this.masterTarget = 0;
    this.status('播放完毕');
    this.syncUI();
  }

  async play(): Promise<boolean> {
    if (this.playing) return true;
    if (this.starting) return false;
    this.starting = true;
    try {
      this.stopTimer = cancel(this.stopTimer);
      if (!this.current) this.current = this.makeVoice();
      // 启动前先清掉所有孤儿音轨，整个页面只保留 current / incoming 两条受管音轨
      for (const v of this.voices) if (v !== this.current) this.dropVoice(v);
      this.incoming = null;
      this.switchFailed = false;
      const from = this.finished ? BGM.loopIn : this.current.currentTime > 0.2 ? this.current.currentTime : BGM.loopIn;
      const ok = await this.startVoice(this.current, from);
      this.finished = false;
      if (!ok) {
        this.current.pause();
        this.current.volume = 0;
        this.status('点一下页面，酒馆音乐就会响起 ♪');
        this.syncUI();
        return false;
      }
      this.cancelGestureFallback();
      this.playing = true;
      this.masterTarget = 1;
      this.status('正在播放');
      this.startRaf();
      this.syncUI();
      return true;
    } finally {
      this.starting = false;
    }
  }

  /** 首次进入即尝试自动播放；被策略拦截时只注册一次真实手势，不弹窗、不反复重试 */
  autoStart(): void {
    void this.play().then((ok) => {
      if (!ok) this.armGestureFallback();
    });
  }

  private armGestureFallback(): void {
    if (this.gesture || this.playing) return;
    const start = () => {
      this.cancelGestureFallback();
      if (!this.playing) void this.play();
    };
    this.gesture = start;
    window.addEventListener('pointerdown', start, { capture: true, passive: true });
    window.addEventListener('keydown', start, { capture: true });
    window.addEventListener('touchend', start, { capture: true, passive: true });
    this.status('点一下页面，酒馆音乐就会响起 ♪');
  }

  private cancelGestureFallback(): void {
    if (!this.gesture) return;
    const g = this.gesture;
    this.gesture = null;
    window.removeEventListener('pointerdown', g, true);
    window.removeEventListener('keydown', g, true);
    window.removeEventListener('touchend', g, true);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.masterTarget = 0; // 1s 渐出；渐出结束会把全部音轨真正 pause
    this.cancelGestureFallback();
    this.forceApply();
    this.status('已暂停');
    this.syncUI();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  setVolume(v: number): void {
    this.prefs.volume = clamp(v);
    this.save();
    this.forceApply();
    this.syncUI();
  }

  toggleMute(): void {
    this.prefs.muted = !this.prefs.muted;
    this.save();
    this.forceApply();
    this.syncUI();
  }

  toggleLoop(): void {
    this.prefs.loop = !this.prefs.loop;
    this.save();
    this.syncUI();
  }

  toggleSfx(): void {
    this.prefs.sfx = !this.prefs.sfx;
    this.save();
    this.syncUI();
  }

  /** 角色音效：默认关闭；开启时用 Web Audio 生成极短像素音，并短暂压低 BGM */
  playSfx(): void {
    if (!this.prefs.sfx) return;
    const now = performance.now();
    if (now - this.lastSfxAt < 220) return; // 不叠音
    this.lastSfxAt = now;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        this.ctx ??= new Ctor();
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        const t0 = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t0);
        osc.frequency.setValueAtTime(1320, t0 + 0.07);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.2);
      }
    } catch {
      /* Web Audio 不可用时静默降级，不影响对话 */
    }
    // ducking 只压低 BGM；音效本身走独立增益，二者互不串扰
    this.duck = 0.32;
    this.duckTimer = cancel(this.duckTimer);
    this.duckTimer = later(() => {
      this.duck = 1;
      this.duckTimer = null;
    }, 420);
  }

  /** 调试/自检用：当前受管音轨数，永远 <= 2 */
  get voiceCount(): number { return this.voices.size; }

  private onVisibility(): void {
    document.body.classList.toggle('is-page-hidden', document.hidden);
    if (document.hidden) {
      this.hiddenWasPlaying = this.playing;
      // 若正在交叉淡化，先完成交接，避免恢复时留下一条暂停的第二音轨
      if (this.incoming) this.finishSwitch();
      for (const v of this.voices) v.pause();
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.lastFrame = 0;
      }
    } else if (this.hiddenWasPlaying) {
      this.hiddenWasPlaying = false;
      const p = this.current?.play();
      p?.catch(() => this.status('点一下 ♪ 继续播放'));
      this.startRaf();
    }
  }

  private teardown(): void {
    this.cancelGestureFallback();
    for (const v of this.voices) v.pause();
  }

  private bindUI(): void {
    if (!this.ui) return;
    one('[data-player-toggle]', this.ui)?.addEventListener('click', () => this.toggle());
    one('[data-player-mute]', this.ui)?.addEventListener('click', () => this.toggleMute());
    one('[data-player-loop]', this.ui)?.addEventListener('click', () => this.toggleLoop());
    one('[data-player-sfx]', this.ui)?.addEventListener('click', () => this.toggleSfx());
    const volume = one<HTMLInputElement>('[data-player-volume]', this.ui);
    volume?.addEventListener('input', () => this.setVolume(Number(volume.value) / 100));
    const collapse = one('[data-player-collapse]', this.ui);
    const expand = one('[data-player-expand]', this.ui);
    collapse?.addEventListener('click', () => {
      this.prefs.collapsed = true;
      this.save();
      this.syncUI();
    });
    expand?.addEventListener('click', () => {
      this.prefs.collapsed = false;
      this.save();
      this.syncUI();
    });
  }

  private syncUI(): void {
    if (!this.ui) return;
    const setPressed = (sel: string, on: boolean, onLabel?: string, offLabel?: string) => {
      const btn = one<HTMLButtonElement>(sel, this.ui!);
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-on', on);
      if (onLabel && offLabel) btn.title = on ? onLabel : offLabel;
    };
    const toggle = one<HTMLButtonElement>('[data-player-toggle]', this.ui);
    if (toggle) {
      toggle.textContent = this.playing ? '❚❚' : '▶';
      toggle.setAttribute('aria-label', this.playing ? '暂停背景音乐' : '播放背景音乐');
      toggle.classList.toggle('is-playing', this.playing);
    }
    const volume = one<HTMLInputElement>('[data-player-volume]', this.ui);
    if (volume) volume.value = String(Math.round(this.prefs.volume * 100));
    const volumeValue = one('[data-player-volume-value]', this.ui);
    if (volumeValue) volumeValue.textContent = `${Math.round(this.prefs.volume * 100)}%`;
    const mute = one<HTMLButtonElement>('[data-player-mute]', this.ui);
    if (mute) mute.textContent = this.prefs.muted ? '静音中' : '静音';
    setPressed('[data-player-mute]', this.prefs.muted, '取消静音', '静音');
    setPressed('[data-player-loop]', this.prefs.loop, '循环已开启', '循环已关闭');
    setPressed('[data-player-sfx]', this.prefs.sfx, '关闭角色音效', '开启角色音效');
    this.ui.classList.toggle('is-collapsed', this.prefs.collapsed);
    const expand = one<HTMLButtonElement>('[data-player-expand]', this.ui);
    if (expand) expand.setAttribute('aria-label', '展开背景音乐播放器');
  }
}

/* ------------------------------------------------------------------ *
 * 2. 热区几何：按 object-fit: cover 的真实绘制矩形换算，支持裁切与缩放
 * ------------------------------------------------------------------ */

function parseObjectPosition(value: string, size: number): number {
  const part = value.trim().split(/\s+/)[0] ?? '';
  if (part.endsWith('%')) return clamp(parseFloat(part) / 100);
  const px = parseFloat(part);
  if (Number.isFinite(px) && size > 0) return clamp(px / size);
  return 0.5;
}

function layoutZones(frame: HTMLElement | null, img: HTMLImageElement | null): void {
  if (!frame || !img) return;
  const cw = frame.clientWidth;
  const ch = frame.clientHeight;
  if (!cw || !ch) return;
  const iw = img.naturalWidth || 1600;
  const ih = img.naturalHeight || 901;
  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const pos = getComputedStyle(img).objectPosition.split(/\s+/);
  const ox = (cw - dw) * parseObjectPosition(pos[0] ?? '50%', cw);
  const oy = (ch - dh) * parseObjectPosition(pos[1] ?? '50%', ch);

  for (const btn of many<HTMLButtonElement>('[data-actor-zone]', frame)) {
    const actor = ACTORS.find((a) => a.id === btn.dataset.actorZone);
    if (!actor) continue;
    const z = actor.zone;
    const left = Math.max(0, ox + z.x * dw);
    const top = Math.max(0, oy + z.y * dh);
    const right = Math.min(cw, ox + (z.x + z.w) * dw);
    const bottom = Math.min(ch, oy + (z.y + z.h) * dh);
    const visible = right - left > 8 && bottom - top > 8;
    btn.style.display = visible ? '' : 'none';
    if (!visible) continue;
    btn.style.left = `${left.toFixed(1)}px`;
    btn.style.top = `${top.toFixed(1)}px`;
    btn.style.width = `${(right - left).toFixed(1)}px`;
    btn.style.height = `${(bottom - top).toFixed(1)}px`;
  }
}

/* ------------------------------------------------------------------ *
 * 3. 角色状态机 + 联动剧情
 * ------------------------------------------------------------------ */

type Phase = 'idle' | 'line' | 'story';

class TavernLife {
  private phase: Phase = 'idle';
  private dlg: HTMLElement | null;
  private frame: HTMLElement | null;
  private nameEl: HTMLElement | null;
  private moodEl: HTMLElement | null;
  private textEl: HTMLElement | null;
  private chapterEl: HTMLElement | null;
  private skipEl: HTMLButtonElement | null;
  private portraitEl: HTMLElement | null;

  private lastLine: Record<ActorId, number> = { dragon: -1, whale: -1, cat: -1 };
  private whaleAwake = false;
  private whaleTimer: number | null = null;
  private catTimer: number | null = null;
  private catClicks = 0;
  private catClickAt = 0;
  private catComboStep = 0;
  private hideTimer: number | null = null;
  private closingTimer: number | null = null;
  private storyTimer: number | null = null;
  private storyQueue: Story | null = null;
  private beatIndex = 0;
  private interactions = 0;
  private comboCount = 0;
  private comboAt = 0;
  private storyLastAt = 0;
  private hiddenUnlocked = false;
  private hiddenPlayed = false;

  constructor(private audio: TavernAudio, private frames: TavernFrames | null) {
    this.frame = one('[data-scene]');
    this.dlg = one('[data-dialogue]');
    this.nameEl = one('[data-dlg-name]', this.dlg ?? document);
    this.moodEl = one('[data-dlg-mood]', this.dlg ?? document);
    this.textEl = one('[data-dlg-text]', this.dlg ?? document);
    this.chapterEl = one('[data-dlg-chapter]', this.dlg ?? document);
    this.skipEl = one<HTMLButtonElement>('[data-dlg-skip]', this.dlg ?? document);
    this.portraitEl = one('[data-dlg-portrait]', this.dlg ?? document);
    this.bindZones();
    this.bindSkip();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.phase === 'story') this.skipStory();
    });
  }

  private bindZones(): void {
    for (const btn of many<HTMLButtonElement>('[data-actor-zone]')) {
      const id = btn.dataset.actorZone as ActorId;
      btn.addEventListener('click', () => this.onActor(id));
    }
  }

  private bindSkip(): void {
    this.skipEl?.addEventListener('click', () => this.skipStory());
  }

  /** 对话框固定在视口底部（RPG 标准布局），完全不遮住插画里任何角色的脸 */
  private show(speaker: string, line: ActorLine, actor: ActorId | 'narrator', chapter = ''): void {
    const dlg = this.dlg;
    if (!dlg) return;
    this.hideTimer = cancel(this.hideTimer);
    dlg.hidden = false;
    document.body.classList.add('has-dialogue');
    if (this.nameEl) this.nameEl.textContent = speaker;
    if (this.moodEl) {
      this.moodEl.textContent = line.mood ?? '';
      this.moodEl.hidden = !line.mood;
    }
    if (this.textEl) this.textEl.textContent = line.text;
    if (this.chapterEl) {
      this.chapterEl.textContent = chapter;
      this.chapterEl.hidden = !chapter;
    }
    if (this.portraitEl) this.portraitEl.dataset.actor = actor;
    dlg.dataset.actor = actor;
    if (!reducedMotion) {
      dlg.classList.remove('is-pop');
      void dlg.offsetWidth;
      dlg.classList.add('is-pop');
    }
  }

  private hide(ms = 0): void {
    this.hideTimer = cancel(this.hideTimer);
    if (ms <= 0) {
      if (this.dlg) this.dlg.hidden = true;
      document.body.classList.remove('has-dialogue');
      return;
    }
    this.hideTimer = later(() => {
      this.hideTimer = null;
      if (this.phase === 'story') return;
      this.hide(0);
    }, ms);
  }

  private actorName(id: ActorId | 'narrator'): string {
    return id === 'narrator' ? '酒馆旁白' : (ACTORS.find((a) => a.id === id)?.name ?? '');
  }

  private normalLine(id: ActorId, line: ActorLine): void {
    this.phase = 'line';
    this.frames?.pulse(id);
    this.show(this.actorName(id), line, id);
    if (this.skipEl) this.skipEl.hidden = true;
    this.hide(TIMING.lineHold);
    later(() => {
      if (this.phase === 'line') this.phase = 'idle';
    }, 900);
  }

  /* ---- 三位角色各自的独立状态 ---- */

  private dragonClick(): void {
    const actor = ACTORS[0];
    const { item, index } = pick(actor.lines, this.lastLine.dragon);
    this.lastLine.dragon = index;
    this.normalLine('dragon', item);
  }

  private whaleClick(): void {
    if (!this.whaleAwake) {
      this.whaleAwake = true;
      this.frame?.classList.add('is-whale-awake');
      const pool = WHALE_WAKE_LINES;
      const { item, index } = pick(pool, this.lastLine.whale);
      this.lastLine.whale = index;
      this.normalLine('whale', item);
      // 将来补齐鲸戒透明帧后，清醒状态会常驻对应帧直到重新睡着
      this.frames?.hold('whale', 1, TIMING.whaleAwakeMs);
    } else {
      const actor = ACTORS[1];
      const { item, index } = pick(actor.lines, this.lastLine.whale);
      this.lastLine.whale = index;
      this.normalLine('whale', item);
    }
    this.resetWhaleTimer();
  }

  private resetWhaleTimer(): void {
    this.whaleTimer = cancel(this.whaleTimer);
    this.whaleTimer = later(() => {
      this.whaleTimer = null;
      this.whaleAwake = false;
      this.frame?.classList.remove('is-whale-awake');
    }, TIMING.whaleAwakeMs);
  }

  private catClick(): void {
    const now = Date.now();
    this.catClicks = now - this.catClickAt < TIMING.catComboWindow ? this.catClicks + 1 : 1;
    this.catClickAt = now;
    let line: ActorLine;
    if (this.catClicks >= TIMING.catCombo) {
      line = CAT_COMBO_LINES[this.catComboStep % CAT_COMBO_LINES.length];
      this.catComboStep += 1;
      this.catClicks = 0; // 触发一次后清零，连点不会无限叠动画
      this.frame?.classList.add('is-cat-alert');
    } else {
      const actor = ACTORS[2];
      const { item, index } = pick(actor.lines, this.lastLine.cat);
      this.lastLine.cat = index;
      line = item;
      this.frame?.classList.add('is-cat-alert');
    }
    this.normalLine('cat', line);
    this.catTimer = cancel(this.catTimer);
    this.catTimer = later(() => {
      this.catTimer = null;
      this.frame?.classList.remove('is-cat-alert');
    }, TIMING.stateResetMs);
  }

  /* ---- 联动剧情：链式 beat，按序、不重叠、可快进 / 跳过 ---- */

  private registerCombo(now: number): void {
    this.comboCount = now - this.comboAt < TIMING.comboWindow ? this.comboCount + 1 : 1;
    this.comboAt = now;
    if (this.comboCount >= TIMING.comboUnlock && !this.hiddenUnlocked) {
      this.hiddenUnlocked = true;
    }
  }

  private maybeStory(now: number): boolean {
    // 前几次点击只聊家常，不把访客直接拽进长剧情
    if (this.interactions < TIMING.storyMinInteractions) return false;
    if (now - this.storyLastAt < TIMING.storyCooldown) return false;
    if (this.hiddenUnlocked && !this.hiddenPlayed && Math.random() < TIMING.hiddenStoryChance) {
      const hidden = STORIES.find((s) => s.hidden);
      if (hidden) {
        this.playStory(hidden, now);
        return true;
      }
    }
    if (Math.random() < TIMING.storyChance) {
      const pool = STORIES.filter((s) => !s.hidden);
      const { item } = pick(pool);
      if (item) {
        this.playStory(item, now);
        return true;
      }
    }
    return false;
  }

  private playStory(story: Story, now: number): void {
    this.cancelStory();
    this.phase = 'story';
    this.storyQueue = story;
    this.storyLastAt = now;
    if (story.hidden) this.hiddenPlayed = true;
    if (this.skipEl) this.skipEl.hidden = false;
    if (story.closing) {
      this.frame?.classList.add('is-closing');
      this.closingTimer = cancel(this.closingTimer);
      this.closingTimer = later(() => {
        this.closingTimer = null;
        this.frame?.classList.remove('is-closing');
      }, story.beats.length * TIMING.beatHold + 9000);
    }
    this.scheduleBeat(0);
  }

  private scheduleBeat(index: number): void {
    if (this.phase !== 'story' || !this.storyQueue || index >= this.storyQueue.beats.length) {
      this.endStory();
      return;
    }
    this.beatIndex = index;
    const beat = this.storyQueue.beats[index];
    this.show(this.actorName(beat.actor), { text: beat.text, mood: beat.mood }, beat.actor, this.storyQueue.title);
    if (beat.actor !== 'narrator') this.frames?.pulse(beat.actor);
    // 剧情里开口说话的鲸戒会短暂醒来
    if (beat.actor === 'whale' && !this.whaleAwake) {
      this.whaleAwake = true;
      this.frame?.classList.add('is-whale-awake');
      this.resetWhaleTimer();
    }
    this.storyTimer = later(() => {
      this.storyTimer = null;
      this.scheduleBeat(index + 1);
    }, TIMING.beatHold);
  }

  /** 剧情播放期间点角色 = 快进下一句，不会出现「点了没反应」 */
  private advanceBeat(): void {
    if (this.phase !== 'story') return;
    this.storyTimer = cancel(this.storyTimer);
    this.scheduleBeat(this.beatIndex + 1);
  }

  private endStory(): void {
    this.cancelStory();
    this.phase = 'idle';
    this.storyQueue = null;
    if (this.skipEl) this.skipEl.hidden = true;
    this.hide(1400);
  }

  private skipStory(): void {
    if (this.phase !== 'story') return;
    videoManager?.cancelPending();
    this.cancelStory();
    this.phase = 'idle';
    this.storyQueue = null;
    if (this.skipEl) this.skipEl.hidden = true;
    this.closingTimer = cancel(this.closingTimer);
    this.frame?.classList.remove('is-closing');
    this.show('酒馆旁白', { text: '……（剧情已跳过）' }, 'narrator');
    this.hide(1600);
  }

  private cancelStory(): void {
    this.storyTimer = cancel(this.storyTimer);
  }

  private onActor(id: ActorId): void {
    const now = Date.now();
    this.audio.playSfx();
    if (this.phase === 'story') {
      this.advanceBeat();
      return;
    }
    this.interactions += 1;
    this.registerCombo(now);
    if (this.maybeStory(now)) return;
    // V1.5：点击反馈（台词/高亮）走原有状态机；视频只加视觉层，可被剧情跳过取消
    videoManager?.react(id);
    if (id === 'dragon') this.dragonClick();
    else if (id === 'whale') this.whaleClick();
    else this.catClick();
  }
}

/* ------------------------------------------------------------------ *
 * 4. 环境层：光点、打烊灯光、后台暂停、逐帧素材渲染器
 * ------------------------------------------------------------------ */

function ambientMotes(frame: HTMLElement | null): void {
  if (reducedMotion || !frame) return;
  const layer = one('[data-scene-motes]', frame);
  if (!layer) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 12; i += 1) {
    const mote = document.createElement('i');
    mote.className = 'scene-fx__mote';
    const x = 8 + Math.random() * 84;
    const y = 46 + Math.random() * 45;
    mote.style.setProperty('--x', `${x.toFixed(2)}%`);
    mote.style.setProperty('--y', `${y.toFixed(2)}%`);
    mote.style.setProperty('--t', `${(7 + Math.random() * 8).toFixed(2)}s`);
    mote.style.setProperty('--d', `${(Math.random() * 9).toFixed(2)}s`);
    mote.style.setProperty('--s', `${Math.random() < 0.3 ? 4 : 3}px`);
    frag.appendChild(mote);
  }
  layer.appendChild(frag);
}

/**
 * V1.3 真实动作帧控制器 —— 状态驱动，不做无限轮播。
 *
 * 图层插在 .scene-frame__art 内部，因此继承底图的 sceneBreathe 呼吸动画；
 * CSS 再补上与 picture 完全相同的 scale(1.02) + --px/--py 视差变换，
 * 保证逐像素对齐、不漂移、不闪烁。只有配了 ≥2 帧的角色才会创建图层，
 * 其余角色保持原始静态图，绝不用 CSS 扭曲伪造动作。
 *
 * pulse() 播放一次动作序列后回到 idle；重复触发先撤销旧定时器，不叠加动画。
 * reduced-motion / 后台标签页直接跳过，不产生无意义轮询。
 */
class TavernFrames {
  private layers = new Map<ActorId, HTMLImageElement>();
  private timers = new Map<ActorId, number[]>();
  /** 持有预载引用，避免浏览器在下载完成前回收 Image 对象 */
  private preloads: HTMLImageElement[] = [];

  constructor(frame: HTMLElement) {
    const art = one<HTMLElement>('.scene-frame__art', frame);
    const baseImg = one<HTMLImageElement>('.scene-frame__art img', frame);
    const plate = FRAME_ASSETS.find((f) => f.actor === 'plate');
    if (plate?.frames.length && baseImg) baseImg.src = plate.frames[0];
    if (!art) return;
    for (const cfg of FRAME_ASSETS) {
      if (cfg.actor === 'plate' || cfg.frames.length < 2) continue;
      const img = document.createElement('img');
      img.className = 'frame-layer';
      img.dataset.frameActor = cfg.actor;
      img.alt = '';
      img.decoding = 'async';
      img.src = cfg.frames[0];
      art.appendChild(img);
      this.layers.set(cfg.actor as ActorId, img);
      // 动作帧只有几 KB，但线上首访走代理时可能要几秒；在页面加载阶段就预取，
      // 否则第一次点击时 1.5s 的停留窗口会在图片下载完成前结束，用户看不到动作。
      for (const src of cfg.frames.slice(1)) {
        const preload = new Image();
        preload.decoding = 'async';
        preload.src = src;
        this.preloads.push(preload);
      }
    }
  }

  private cancel(actor: ActorId): void {
    for (const id of this.timers.get(actor) ?? []) window.clearTimeout(id);
    this.timers.set(actor, []);
  }

  private after(actor: ActorId, fn: () => void, ms: number): void {
    const id = window.setTimeout(fn, ms);
    const list = this.timers.get(actor) ?? [];
    list.push(id);
    this.timers.set(actor, list);
  }

  private set(actor: ActorId, src: string): void {
    const img = this.layers.get(actor);
    if (img && img.getAttribute('src') !== src) img.src = src;
  }

  /** 一次性动作帧；点击角色 / 剧情台词时触发 */
  pulse(actor: ActorId): void {
    const cfg = FRAME_ASSETS.find((f) => f.actor === actor);
    const img = this.layers.get(actor);
    if (!cfg || !img || cfg.frames.length < 2) return;
    if (reducedMotion || document.hidden || document.body.classList.contains('is-page-hidden')) return;
    this.cancel(actor);
    const actions = cfg.frames.slice(1);
    actions.forEach((src, i) => this.after(actor, () => this.set(actor, src), i * cfg.frameMs));
    this.after(actor, () => this.set(actor, cfg.frames[0]),
      actions.length * cfg.frameMs + TIMING.frameHoldMs);
  }

  /** 常驻某帧（鲸戒清醒等），到时自动回 idle */
  hold(actor: ActorId, index: number, ms: number): void {
    const cfg = FRAME_ASSETS.find((f) => f.actor === actor);
    if (!cfg || !this.layers.has(actor) || cfg.frames.length < 2) return;
    if (reducedMotion || document.hidden) return;
    this.cancel(actor);
    this.set(actor, cfg.frames[Math.min(index, cfg.frames.length - 1)]);
    this.after(actor, () => this.set(actor, cfg.frames[0]), ms);
  }
}

/* ------------------------------------------------------------------ *
 * 5. 启动
 * ------------------------------------------------------------------ */

let audioSingleton: TavernAudio | null = null;
let booted = false;

function boot(): void {
  // 单例守卫：即使脚本被重复注入，也只允许一个音频管理器 / 一套 UI 绑定
  if (booted) return;
  booted = true;
  const globals = window as unknown as { __tavernAudioBooted?: boolean };
  if (globals.__tavernAudioBooted) return;
  globals.__tavernAudioBooted = true;

  // V1.7：全站按钮按下反馈（纯视觉、事件委托，不改任何原有点击逻辑）
  initUiFeedback();

  const frame = one<HTMLElement>('[data-scene]');
  const img = one<HTMLImageElement>('.scene-frame__art img', frame ?? document);
  const player = one<HTMLElement>('[data-player]');
  const audio = audioSingleton ?? new TavernAudio(player);
  audioSingleton = audio;
  const frames = frame ? new TavernFrames(frame) : null;
  // V1.5：视频层与音频层相互独立；失败/弱网/reduced-motion 时内部自动静态回退
  videoManager = frame ? new TavernVideoManager(frame) : null;
  new TavernLife(audio, frames);

  if (frame && img) {
    const relayout = () => layoutZones(frame, img);
    relayout();
    if (img.complete) relayout();
    else img.addEventListener('load', relayout, { once: true });
    window.addEventListener('resize', relayout, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(frame);
    ambientMotes(frame);
  }

  // V1.3：默认开启 BGM，首次进入尝试自动播放；被拦截则等第一次真实手势
  audio.autoStart();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
