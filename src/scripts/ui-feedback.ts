/**
 * Bistro's Tavern V1.7 — 统一按钮操作反馈
 *
 * 职责：给所有可交互元素一个"立刻看得见"的按下反馈，解决"点了没反应"的感知问题。
 *  - 指针按下 / 键盘 Enter、Space 都触发，键盘用元素中心定位涟漪。
 *  - 纯视觉，事件委托，不 preventDefault、不 stopPropagation，完全不改原有点击逻辑。
 *  - reduced-motion 下不加涟漪元素，只保留极短的亮度脉冲（CSS 已把动画时长压到 0.001ms）。
 */

const INTERACTIVE =
  'button, .btn, a[href], .filter-chip, .companion-card, .actor-zone, .dossier-jump, .quest-card__cta, input[type="range"]';

export function initUiFeedback(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const press = (el: HTMLElement) => {
    el.classList.remove('is-pressed');
    void el.offsetWidth; // 重启动画，连点也有反馈
    el.classList.add('is-pressed');
    window.setTimeout(() => el.classList.remove('is-pressed'), 360);
  };

  const ripple = (x: number, y: number) => {
    if (reduce) return;
    const dot = document.createElement('span');
    dot.className = 'tap-ripple';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    window.setTimeout(() => dot.remove(), 380);
  };

  document.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE);
    if (!target || target.hasAttribute('disabled') || target.classList.contains('is-disabled')) return;
    press(target);
    ripple(e.clientX, e.clientY);
  }, { passive: true });

  // 键盘激活：只在 Enter / Space 的 keydown 给反馈，click 由浏览器随后正常触发
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE);
    if (!target) return;
    const r = target.getBoundingClientRect();
    press(target);
    ripple(r.left + r.width / 2, r.top + r.height / 2);
  });
}
