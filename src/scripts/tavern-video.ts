/**
 * Bistro's Tavern V1.5 — TavernVideoManager
 *
 * 统一头图视频状态机，仅管理静态头图 / 待机视频 / 三角色互动视频的切换。
 * 与 TavernAudio（BGM）完全独立：所有视频无音轨、静音、内联播放。
 *
 * 状态：STATIC → IDLE_LOADING → IDLE_PLAYING → REACT_LOADING → REACT_PLAYING
 *       → RETURNING → IDLE_PLAYING；任何异常 → ERROR（静态回退）。
 *
 * 设计要点：
 *  - 先准备目标视频到可播放，再切换可见层，绝不先隐藏当前层造成黑屏。
 *  - 同一时刻只有一个 <video> 真正在播；切换时允许极短重叠避免黑屏。
 *  - 连点：当前动画不截断；只保留一个"最新待处理请求"，被更新请求覆盖。
 *  - 失败（404 / 解码 / 自动播放被拦截 / 超时）都回退静态图，不无限重试。
 *  - 页面隐藏暂停解码；回到前台恢复；reduced-motion / 弱网不启用视频。
 *
 * 本模块不 import 第三方库，不触碰 BGM、台词、剧情状态机、热区坐标。
 */

import type { ActorId } from '../data/tavern';

type State =
  | 'STATIC'
  | 'IDLE_LOADING'
  | 'IDLE_PLAYING'
  | 'REACT_LOADING'
  | 'REACT_PLAYING'
  | 'RETURNING'
  | 'ERROR';

type Source = { webm: string; mp4: string };

const SOURCES: Record<'idle' | ActorId, Source> = {
  idle: { webm: '/videos/tavern-idle.webm', mp4: '/videos/tavern-idle.mp4' },
  dragon: { webm: '/videos/dragon-react.webm', mp4: '/videos/dragon-react.mp4' },
  whale: { webm: '/videos/whale-react.webm', mp4: '/videos/whale-react.mp4' },
  cat: { webm: '/videos/cat-react.webm', mp4: '/videos/cat-react.mp4' },
};

const LOAD_TIMEOUT_MS = 12000;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};
const idleWin = window as IdleWindow;
const whenIdle = (cb: () => void, timeout: number) => {
  if (typeof idleWin.requestIdleCallback === 'function') idleWin.requestIdleCallback(cb, { timeout });
  else window.setTimeout(cb, Math.min(timeout, 3000));
};

function pickSource(src: Source): string {
  const canWebm = document.createElement('video').canPlayType('video/webm; codecs="vp9"');
  return canWebm ? src.webm : src.mp4;
}

export class TavernVideoManager {
  private state: State = 'STATIC';
  private enabled = false;
  private art: HTMLElement | null = null;

  private idle: HTMLVideoElement | null = null;
  private reacts: Partial<Record<ActorId, HTMLVideoElement>> = {};

  private pending: ActorId | null = null; // 最多一个待处理请求（最新覆盖）
  private active: ActorId | null = null;  // 当前正在播放的 react
  private loadTimer: number | null = null;
  private idleRetryBound = false;

  constructor(frame: HTMLElement) {
    const art = frame.querySelector<HTMLElement>('.scene-frame__art');
    if (!art) return;
    this.art = art;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !this.networkOK() || !HTMLVideoElement.prototype.canPlayType) return;

    this.enabled = true;
    this.state = 'IDLE_LOADING';
    this.buildIdle();
    // 三段 react 只建元素、不加载数据；首屏空闲后再预载元数据
    (['dragon', 'whale', 'cat'] as ActorId[]).forEach((id) => this.buildReact(id));

    this.scheduleIdlePrefetch();
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  /** 弱网 / 省流模式不启用视频 */
  private networkOK(): boolean {
    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (!conn) return true;
    if (conn.saveData) return false;
    // 只禁 2g/slow-2g；3g 仍可用，但预载走 requestIdleCallback 保守处理
    return !/^(slow-2g|2g)$/.test(conn.effectiveType ?? '');
  }

  private makeVideo(src: Source, loop: boolean, role: string): HTMLVideoElement {
    const v = document.createElement('video');
    v.className = `scene-video scene-video--${role}`;
    v.src = pickSource(src);
    v.muted = true;
    v.defaultMuted = true;
    v.loop = loop;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.preload = 'none';
    return v;
  }

  private buildIdle(): void {
    const v = this.makeVideo(SOURCES.idle, true, 'idle');
    v.preload = 'metadata';
    v.addEventListener('error', () => this.fail(), { once: true });
    // 首帧真正可显示（HAVE_CURRENT_DATA）才切换可见层
    v.addEventListener('loadeddata', () => this.tryStartIdle(), { once: true });
    this.idle = v;
    this.art?.appendChild(v);
  }

  private buildReact(id: ActorId): void {
    const v = this.makeVideo(SOURCES[id], false, `react-${id}`);
    v.addEventListener('error', () => this.onReactError(id));
    v.addEventListener('ended', () => this.onReactEnded(id));
    // 目标首帧可显示后才真正切换（避免黑屏 / 等待）
    v.addEventListener('canplay', () => this.onReactReady(id));
    this.reacts[id] = v;
    this.art?.appendChild(v);
  }

  /** 首屏空闲后预载 idle 数据；再空闲预载三段 react 元数据 */
  private scheduleIdlePrefetch(): void {
    const start = () => {
      if (!this.idle) return;
      this.idle.preload = 'auto';
      this.idle.load();
      this.armLoadTimeout(this.idle, () => this.tryStartIdle());
      const prefetch = () => {
        (['dragon', 'whale', 'cat'] as ActorId[]).forEach((id) => {
          const v = this.reacts[id];
          if (v && v.preload === 'none') v.preload = 'metadata';
        });
      };
      whenIdle(prefetch, 5000);
    };
    whenIdle(start, 2500);
  }

  private armLoadTimeout(v: HTMLVideoElement, onReady: () => void): void {
    this.clearLoadTimer();
    this.loadTimer = window.setTimeout(() => {
      if (v.readyState < 2 && this.state !== 'ERROR') this.fail();
      else onReady();
    }, LOAD_TIMEOUT_MS);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer !== null) {
      window.clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  private tryStartIdle(): void {
    if (!this.idle || !this.enabled || this.state === 'ERROR') return;
    if (this.state !== 'IDLE_LOADING' && this.state !== 'RETURNING') return;
    if (this.idle.readyState < 2) return;
    this.clearLoadTimer();
    this.idle.play().then(() => {
      this.state = 'IDLE_PLAYING';
      this.idle?.classList.add('is-ready');
      this.idle?.classList.add('is-shown');
      this.art?.classList.add('has-video');
    }).catch(() => this.handleAutoplayBlocked());
  }

  /** 自动播放被浏览器阻止：静态图继续显示，绑定一次性手势再试 */
  private handleAutoplayBlocked(): void {
    if (this.idleRetryBound || !this.idle) return;
    this.idleRetryBound = true;
    const retry = () => {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
      if (this.state === 'ERROR' || !this.idle) return;
      this.idle.play().then(() => {
        this.state = 'IDLE_PLAYING';
        this.idle?.classList.add('is-ready');
        this.idle?.classList.add('is-shown');
        this.art?.classList.add('has-video');
      }).catch(() => this.fail());
    };
    document.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
  }

  /** 点击角色：立即反馈由台词/高亮负责（TavernLife），这里只管视频 */
  react(id: ActorId): void {
    if (!this.enabled || this.state === 'ERROR' || document.hidden) return;
    if (this.active === id) return; // 同一角色互动中重复点击：不重启动画

    // 不同角色：当前动画不截断，只记录最新待处理请求（覆盖旧的）
    if (this.state === 'REACT_PLAYING' || this.state === 'REACT_LOADING' || this.state === 'RETURNING') {
      this.pending = id;
      return;
    }

    this.startReact(id);
  }

  private startReact(id: ActorId): void {
    const v = this.reacts[id];
    if (!v) return;
    this.pending = null;
    if (v.readyState >= 3) {
      this.swapToReact(id, v);
    } else {
      this.state = 'REACT_LOADING';
      v.preload = 'auto';
      v.load();
      this.armLoadTimeout(v, () => {
        if (v.readyState >= 3) this.swapToReact(id, v);
        else this.fail();
      });
    }
  }

  /** 目标首帧可显示时被调用：若正等待该视频则切换 */
  private onReactReady(id: ActorId): void {
    if (this.state !== 'REACT_LOADING') return;
    const v = this.reacts[id];
    if (v && v.readyState >= 3) this.swapToReact(id, v);
  }

  /** 先让目标就绪、再单层可见切换：当前层不提前隐藏，避免黑屏 */
  private swapToReact(id: ActorId, v: HTMLVideoElement): void {
    this.clearLoadTimer();
    this.active = id;
    this.idle?.pause();
    this.idle?.classList.remove('is-shown');
    this.state = 'REACT_PLAYING';
    v.currentTime = 0;
    v.play().then(() => v.classList.add('is-shown')).catch(() => this.onReactError(id));
  }

  private onReactEnded(id: ActorId): void {
    if (this.active !== id) return;
    this.reacts[id]?.classList.remove('is-shown');
    this.reacts[id]?.pause();
    this.active = null;
    this.returnToIdle();
  }

  private onReactError(id: ActorId): void {
    this.reacts[id]?.classList.remove('is-shown');
    if (this.active === id) this.active = null;
    // 单个互动视频失败不影响静态图与台词，回退待机
    this.returnToIdle();
  }

  /** 互动结束恢复待机；待机未就绪时先用静态图过渡 */
  private returnToIdle(): void {
    if (!this.enabled || this.state === 'ERROR') return;
    this.state = 'RETURNING';
    if (this.idle && this.idle.readyState >= 2) {
      this.idle.currentTime = 0;
      this.idle.play().then(() => {
        this.state = 'IDLE_PLAYING';
        this.idle?.classList.add('is-shown');
        this.flushPending();
      }).catch(() => {
        this.art?.classList.remove('has-video');
        this.state = 'STATIC';
        this.flushPending();
      });
    } else {
      // 待机首帧没准备好：静态头图过渡
      this.art?.classList.remove('has-video');
      this.idle?.classList.remove('is-shown');
      this.state = 'STATIC';
      this.flushPending();
    }
  }

  /** 处理排队的最新请求（只有一个） */
  private flushPending(): void {
    const next = this.pending;
    this.pending = null;
    if (next && this.state === 'IDLE_PLAYING') this.startReact(next);
  }

  /** 剧情跳过时调用：取消待处理动画，安全回到待机 */
  cancelPending(): void {
    this.pending = null;
  }

  private onVisibility(): void {
    if (!this.enabled) return;
    if (document.hidden) {
      this.idle?.pause();
      if (this.active) this.reacts[this.active]?.pause();
    } else if (this.state === 'IDLE_PLAYING') {
      this.idle?.play().catch(() => {});
    } else if (this.state === 'REACT_PLAYING' && this.active) {
      this.reacts[this.active]?.play().catch(() => this.onReactError(this.active!));
    }
  }

  /** 全局失败：释放所有视频资源，回退静态头图，不重试 */
  private fail(): void {
    this.state = 'ERROR';
    this.clearLoadTimer();
    this.art?.classList.remove('has-video');
    [this.idle, ...Object.values(this.reacts)].forEach((v) => {
      if (!v) return;
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    });
    this.idle = null;
    this.reacts = {};
    this.enabled = false;
  }
}
