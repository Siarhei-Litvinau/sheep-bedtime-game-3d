// Диагностика звука на реальном телефоне: удалённый devtools (chrome://inspect,
// Web Inspector) требует кабель и компьютер рядом, а тут звук ломается именно
// на реальном устройстве и не воспроизводится ни на десктопе, ни под
// devtools-эмуляцией (см. AudioManager.js). Этот оверлей печатает состояние
// AudioManager прямо на экране телефона — включается query-параметром
// ?audiodebug=1 в URL, чтобы не мешать обычной игре.
const ENABLED = typeof location !== 'undefined' && new URLSearchParams(location.search).has('audiodebug');

export function createAudioDebugOverlay() {
  if (!ENABLED) return { log() {} };

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'left:0', 'bottom:0', 'right:0', 'z-index:99999',
    'max-height:45vh', 'overflow-y:auto', 'background:rgba(0,0,0,0.85)',
    'color:#4f4', 'font:11px/1.4 monospace', 'padding:6px 8px',
    'white-space:pre-wrap', 'pointer-events:none',
  ].join(';');
  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
  }

  const lines = [];
  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    lines.push(`${ts} ${line}`);
    if (lines.length > 60) lines.shift();
    el.textContent = lines.join('\n');
  }
  log(`UA: ${navigator.userAgent}`);
  log(`location: ${location.href}`);
  return { log };
}
