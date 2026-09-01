// Звук (audio-download-prompt.md, раздел 3 — таблица событий → файлы).
// Файлы реально лежат в public/audio/ (не assets/audio/, как в промте:
// Vite отдаёт как есть только public/, assets/audio/ в корне проекта в
// dev-сервер/сборку не попадает — это просто папка-источник скачивания).
//
// Web Audio API напрямую, без Howler.js — проект уже держит нулевые
// рантайм-зависимости кроме three, добавлять ради сведения буфера к паре
// gain-нод не за чем. Двух шинам (sfx/music) соответствуют свои GainNode:
// sfx-шина завязана на тот же угасающий responseIntensity (раздел 4), что
// и визуальный отклик (свечение/искры), music-шина — на прогресс сессии
// (раздел 6, та же кривая яркости, что тускнеет к финалу).
const SFX_BUS_VOLUME = 0.6; // "не более 60% от максимума" — раздел 1 промта
const MUSIC_BUS_VOLUME = 0.6;
const MUSIC_FADE_TIMECONST = 1.2;
const MUSIC_SESSION_END_FLOOR = 0.12; // не гаснет до полного нуля по ходу сессии — добивает fadeOut() на финале

const SFX_FILES = {
  tapSoft: 'audio/tap_soft.mp3',
  tapGentle: 'audio/tap_gentle.mp3',
  sheepBleat: 'audio/sheep_bleat.mp3', // раздел 4 промта — докачивается вручную
  owlHoot: 'audio/owl_hoot.mp3',
  catPurr: 'audio/cat_purr.mp3',
};
const MUSIC_FILE = 'audio/background_ambient.mp3'; // раздел 4 промта — докачивается вручную

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Управляет всеми звуками игры (см. таблицу событий в audio-download-prompt.md,
 * раздел 3). Не бросает исключений и не блокирует игру, если какой-то файл
 * не скачан (background_ambient.mp3 / sheep_bleat.mp3 требуют ручного
 * скачивания с Pixabay, раздел 4 промта, лицензия — Pixabay Content
 * License, раздел 5) — такие звуки молча пропускаются.
 */
export class AudioManager {
  constructor() {
    this.context = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.buffers = new Map(); // ключ SFX_FILES → AudioBuffer | null (не загрузился)
    this.musicBuffer = null;
    this.musicSource = null;
    this._activeLoops = new Set();
    this._unlocked = false;
    this._musicSessionMultiplier = 1;
  }

  /**
   * Создаёт AudioContext и начинает загрузку файлов. Должен вызываться
   * синхронно из обработчика пользовательского жеста (клик по кнопке
   * старта сессии в main.js) — иначе браузер не разрешит звук.
   */
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // старый браузер без Web Audio — тихо без звука, не критично

    this.context = new Ctx();
    if (this.context.state === 'suspended') this.context.resume();

    this.sfxBus = this.context.createGain();
    this.sfxBus.gain.value = SFX_BUS_VOLUME;
    this.sfxBus.connect(this.context.destination);

    this.musicBus = this.context.createGain();
    this.musicBus.gain.value = 0; // громкость подтянет setSessionProgress() на первом кадре
    this.musicBus.connect(this.context.destination);

    for (const key of Object.keys(SFX_FILES)) this._loadSfx(key);
    this._loadMusic();
  }

  async _loadSfx(key) {
    const buffer = await this._fetchBuffer(SFX_FILES[key]);
    this.buffers.set(key, buffer);
  }

  async _loadMusic() {
    this.musicBuffer = await this._fetchBuffer(MUSIC_FILE);
    if (this.musicBuffer) this._startMusic();
  }

  async _fetchBuffer(relativePath) {
    const url = `${import.meta.env.BASE_URL}${relativePath}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return await this.context.decodeAudioData(arrayBuffer);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[audio] "${relativePath}" не загружен — звук пропущен (см. audio-download-prompt.md, раздел 4)`, err);
      }
      return null;
    }
  }

  _startMusic() {
    if (!this.context || !this.musicBuffer) return;
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicBus);
    source.start();
    this.musicSource = source;
  }

  /**
   * Одноразовый звук события (раздел 3 промта: тап/прыжок/приземление/окно/NPC).
   * volume — множитель относительно потолка sfx-шины (0..1), rate — питч
   * (playbackRate), используется для "заряд/прыжок" (раздел 3: "можно
   * слегка повысить тон программно").
   */
  play(key, { volume = 1, rate = 1 } = {}) {
    if (!this.context || this.context.state !== 'running') return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = this.context.createGain();
    gain.gain.value = clamp01(volume);
    source.connect(gain);
    gain.connect(this.sfxBus);
    source.start();
  }

  /**
   * Зацикленный на несколько секунд звук (раздел 3: мурчание кота "зациклить
   * на 2–3 сек после срабатывания"), сам себя останавливает.
   */
  playLooped(key, { volume = 1, durationSec = 2.5 } = {}) {
    if (!this.context || this.context.state !== 'running') return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.context.createGain();
    gain.gain.value = clamp01(volume);
    source.connect(gain);
    gain.connect(this.sfxBus);
    source.start();
    this._activeLoops.add(source);

    const stopAt = this.context.currentTime + durationSec;
    gain.gain.setTargetAtTime(0, stopAt - 0.3, 0.15); // короткий fade-out перед остановкой, без щелчка
    source.stop(stopAt);
    source.onended = () => this._activeLoops.delete(source);
  }

  /**
   * Громкость sfx-шины = f(угасающий отклик сессии, раздел 4) — тот же
   * responseIntensityAt(progress), что уже двигает свечение/искры овцы,
   * здесь просто ещё один потребитель того же числа (main.js → tick()).
   */
  setSfxIntensity(intensity) {
    if (!this.sfxBus || !this.context) return;
    this.sfxBus.gain.setTargetAtTime(SFX_BUS_VOLUME * clamp01(intensity), this.context.currentTime, 0.3);
  }

  /**
   * Громкость музыки = f(прогресс сессии, раздел 6) — та же кривая яркости
   * сцены: музыка тише к финалу вместе со светом, но не до нуля (это
   * доделывает fadeOut() отдельно на самом конце сессии).
   */
  setSessionProgress(progress) {
    this._musicSessionMultiplier = 1 - clamp01(progress) * (1 - MUSIC_SESSION_END_FLOOR);
    if (!this.musicBus || !this.context) return;
    this.musicBus.gain.setTargetAtTime(
      MUSIC_BUS_VOLUME * this._musicSessionMultiplier,
      this.context.currentTime,
      MUSIC_FADE_TIMECONST
    );
  }

  /** Финал сессии (раздел 3: "Завершение сессии / затемнение" — тишина + затухание музыки). */
  fadeOut(durationSec = 6) {
    if (!this.musicBus || !this.context) return;
    this.musicBus.gain.setTargetAtTime(0, this.context.currentTime, durationSec / 3);
  }
}
