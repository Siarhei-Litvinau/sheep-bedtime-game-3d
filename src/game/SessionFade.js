const FADE_DURATION = 7; // сек — плавное угасание экрана до чёрного

/**
 * Автозавершение сессии (раздел 11, п.11; раздел 4: "Завершение").
 * После последней овцы сцена сама плавно гаснет до чёрного — без
 * ожидания действия игрока.
 */
export class SessionFade {
  constructor(overlayElement) {
    this.overlay = overlayElement;
    this.active = false;
    this.t = 0;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.t = 0;
  }

  get isDone() {
    return this.active && this.t >= FADE_DURATION;
  }

  update(dt) {
    if (!this.active || this.t >= FADE_DURATION) return;
    this.t = Math.min(this.t + dt, FADE_DURATION);
    this.overlay.style.opacity = String(this.t / FADE_DURATION);
  }
}
