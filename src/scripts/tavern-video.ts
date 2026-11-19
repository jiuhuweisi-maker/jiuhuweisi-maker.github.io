/**
 * Bistro's Tavern V1.6 — TavernVideoManager（画面稳定版）
 *
 * 统一头图视频状态机，仅管理静态头图 / 待机视频 / 三角色互动视频的切换。
 * 与 TavernAudio（BGM）完全独立：所有视频无音轨、静音、内联播放。
 *
 * 状态：STATIC → IDLE_LOADING → IDLE_PLAYING → REACT_LOADING → REACT_PLAYING
 *       → RETURNING → IDLE_PLAYING；任何异常 → ERROR（静态回退）。
 *
 * V1.6 稳定性约束（针对「没人点还在抖 / 切换时闪烁」）：
 *  - 静态底图始终可见，视频层只在就绪后覆盖；任何空窗都露出主视觉，绝不黑底。
 *  - 所有可见层切换统一走 switchLayer()，在同一个 requestAnimationFrame 内
 *    先亮新层、再灭旧层；不做 opacity 交叉淡入，避免半透明叠图造成亮度跳变。
 *  - 切换前先 rewind() 到 0 并等 seeked，确保显示的是首帧而不是黑帧/旧帧。
 *  - 父级 sceneBreathe 无限缩放已由 CSS 移除；视频层与底图保持同一套变换。
 *  - 连点：当前动画不截断；只保留一个"最新待处理请求"，被更新请求覆盖。
 *  - 失败（404 / 解码 / 自动播放被拦截 / 超时）都回退静态图，不无限重试。
 *  - 页面隐藏暂停解码；回到前台只恢复当前可见层；reduced-motion / 弱网不启用视频。
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
const SEEK_TIMEOUT_MS = 600;

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
  /** 当前可见的视频层；所有切换都经由 switchLayer 同帧完成 */
  private current: HTMLVideoElement | null = null;

  private pending: ActorId | null = null; // 最多一个待处理请求（最新覆盖）
  private active: ActorId | null = null;  // 当前正在播放的 react
  private loading: ActorId | null = null; // 当前正在加载的目标，防止旧请求抢先切换
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
    // 兜底：个别浏览器在后台/节流时漏发 ended，用播放进度强制收尾，避免停在末帧假死
    v.addEventListener('timeupdate', () => {
      if (this.active === id && !v.paused && v.duration > 0 && v.currentTime >= v.duration - 0.18) {
        this.onReactEnded(id);
      }
    });
    // 目标首帧可显示后才真正切换（避免黑屏 / 等待）
    v.addEventListener('loadeddata', () => this.onReactReady(id));
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

  /**
   * 统一可见层切换：目标就绪后，在同一个 rAF 内先亮新层、再灭旧层。
   * 视频层无 opacity 过渡，因此不存在两层半透明叠加或中间空窗。
   */
  private switchLayer(
    next: HTMLVideoElement | null,
    onError?: () => void,
    onDone?: () => void,
  ): void {
    const prev = this.current;
    if (next === prev) {
      // V1.7 关键修复：目标已是当前层时也要重新 play()。
      // 之前这里直接 return，导致视频一旦被暂停（自动播放策略 / 切后台 / 上一轮
      // 切换的 pause），后续所有"恢复播放"调用都被短路，画面永久停在静帧。
      if (next && next.paused) void next.play().catch(() => onError?.());
      onDone?.();
      return;
    }
    window.requestAnimationFrame(() => {
      if (next) {
        next.classList.add('is-shown');
        // 静音 + playsInline：自动播放通常允许；由点击触发的 react 必然允许
        void next.play().catch(() => {
          // AbortError 是切换过程中被 pause 打断的正常现象，不要误判为失败
          if (next !== this.current) return;
          onError?.();
        });
      }
      if (prev && prev !== next) {
        prev.classList.remove('is-shown');
        prev.pause();
      }
      this.current = next;
      onDone?.();
    });
  }

  /** seek 回 0 并等首帧解码完成，避免切换瞬间出现黑帧或上一轮的旧帧 */
  private rewind(v: HTMLVideoElement): Promise<void> {
    if (v.currentTime <= 0.02) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        v.removeEventListener('seeked', finish);
        window.clearTimeout(timer);
        resolve();
      };
      timer = window.setTimeout(finish, SEEK_TIMEOUT_MS);
      v.addEventListener('seeked', finish);
      v.currentTime = 0;
    });
  }

  private tryStartIdle(): void {
    if (!this.idle || !this.enabled || this.state === 'ERROR') return;
    if (this.state !== 'IDLE_LOADING' && this.state !== 'RETURNING') return;
    if (this.idle.readyState < 2) return;
    this.clearLoadTimer();
    void this.rewind(this.idle).then(() => {
      if (!this.enabled || this.state === 'ERROR') return;
      if (this.state !== 'IDLE_LOADING' && this.state !== 'RETURNING') return;
      this.art?.classList.add('has-video');
      this.state = 'IDLE_PLAYING';
      this.switchLayer(this.idle, () => this.handleAutoplayBlocked());
    });
  }

  /** 自动播放被浏览器阻止：静态图继续显示，绑定一次性手势再试 */
  private handleAutoplayBlocked(): void {
    if (this.idleRetryBound || !this.idle) return;
    this.idleRetryBound = true;
    const retry = () => {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
      if (this.state === 'ERROR' || !this.idle) return;
      this.state = 'IDLE_PLAYING';
      this.switchLayer(this.idle, () => this.fail());
    };
    document.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
  }

  /** 点击角色：立即反馈由台词/高亮负责（TavernLife），这里只管视频 */
  react(id: ActorId): void {
    if (!this.enabled || this.state === 'ERROR') return;
    if (this.active === id && this.state === 'REACT_PLAYING') return; // 同角色互动中重复点击：不重启动画

    // 页面不可见时不丢弃用户意图，记下来，回到前台再执行
    if (document.hidden) {
      this.pending = id;
      return;
    }

    // V1.7：不同角色立即切换，不再排队等上一段 8s 播完。
    // 旧逻辑把请求 pending 到上一段结束才处理，用户连点时会觉得"点了没反应"。
    // 若目标仍在加载中则覆盖为最新请求，避免半途切走造成闪烁。
    this.startReact(id);
  }

  private startReact(id: ActorId): void {
    const v = this.reacts[id];
    if (!v) return;
    this.pending = null;
    this.loading = id;
    if (v.readyState >= 2) {
      this.swapToReact(id, v);
      return;
    }
    this.state = 'REACT_LOADING';
    v.preload = 'auto';
    v.load();
    this.armLoadTimeout(v, () => {
      if (this.loading !== id) return; // 已被更新的点击覆盖
      if (v.readyState >= 2) this.swapToReact(id, v);
      else this.fail();
    });
  }

  /** 目标首帧可显示时被调用：若正等待该视频则切换 */
  private onReactReady(id: ActorId): void {
    if (this.state !== 'REACT_LOADING' || this.loading !== id) return;
    const v = this.reacts[id];
    if (v && v.readyState >= 2) this.swapToReact(id, v);
  }

  /** 先让目标回到首帧、再同帧替换；当前层在整个准备期间继续播放，不提前隐藏 */
  private swapToReact(id: ActorId, v: HTMLVideoElement): void {
    this.clearLoadTimer();
    this.loading = null;
    this.active = id;
    this.pending = null;
    this.state = 'REACT_PLAYING';
    void this.rewind(v).then(() => {
      if (this.active !== id || this.state !== 'REACT_PLAYING') return;
      this.switchLayer(v, () => this.onReactError(id));
    });
  }

  private onReactEnded(id: ActorId): void {
    if (this.active !== id) return;
    this.active = null;
    // 不在这里提前 remove class，交给 returnToIdle 的同帧切换处理
    this.returnToIdle();
  }

  private onReactError(id: ActorId): void {
    if (this.loading === id) this.loading = null;
    if (this.active === id) this.active = null;
    // 单个互动视频失败不影响静态图与台词，回退待机
    this.returnToIdle();
  }

  /** 互动结束恢复待机；待机未就绪时先用静态图过渡 */
  private returnToIdle(): void {
    if (!this.enabled || this.state === 'ERROR') return;
    this.state = 'RETURNING';
    const idle = this.idle;
    if (idle && idle.readyState >= 2) {
      void this.rewind(idle).then(() => {
        if (!this.enabled || this.state === 'ERROR') return;
        if (this.state !== 'RETURNING') return;
        this.state = 'IDLE_PLAYING';
        this.switchLayer(idle, () => this.fallbackToStatic(), () => this.flushPending());
      });
    } else {
      this.fallbackToStatic();
      this.flushPending();
    }
  }

  /** 单层静态回退：只撤掉视频层，静态底图与台词完全不受影响 */
  private fallbackToStatic(): void {
    this.switchLayer(null);
    this.state = 'STATIC';
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
    } else {
      // 回到前台：先执行后台期间累积的点击意图，再恢复可见层播放
      const next = this.pending;
      this.pending = null;
      if (next && this.active !== next) {
        this.startReact(next);
        return;
      }
      if (this.current) {
        // 即使 current 未变也调用 switchLayer，同层短路分支会确保 paused 时被重新 play()
        const isReact = this.active && this.current === this.reacts[this.active];
        this.switchLayer(this.current, () => {
          if (this.active) this.onReactError(this.active);
        });
        void isReact; // 保留语义：react 失败走 onReactError 回退
      }
    }
  }

  /** 全局失败：释放所有视频资源，回退静态头图，不重试 */
  private fail(): void {
    this.state = 'ERROR';
    this.clearLoadTimer();
    this.loading = null;
    this.art?.classList.remove('has-video');
    this.current = null;
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
