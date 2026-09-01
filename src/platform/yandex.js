/**
 * Интеграция SDK Яндекс Игр (раздел 10). Все обращения к платформе — через
 * этот модуль. SDK-скрипт подключается в index.html; вне платформы
 * (обычный браузер, локальная разработка) window.YaGames отсутствует —
 * все функции ниже в этом случае безопасно ничего не делают.
 */
let ysdkPromise = null;

function getSdk() {
  if (typeof window === 'undefined' || typeof window.YaGames === 'undefined') {
    return Promise.resolve(null);
  }
  if (!ysdkPromise) {
    ysdkPromise = window.YaGames.init().catch(() => null);
  }
  return ysdkPromise;
}

/** Сигнал платформе, что игра прогрузилась и готова — скрывает лоадер Яндекс Игр. */
export async function notifyGameReady() {
  const ysdk = await getSdk();
  ysdk?.features?.LoadingAPI?.ready?.();
}

/** Имя игрока, если он уже авторизован в Яндексе (без принудительного логина). */
export async function getPlayerName() {
  const ysdk = await getSdk();
  if (!ysdk) return null;
  try {
    const player = await ysdk.getPlayer({ scopes: false });
    return player?.getName?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Липкий баннер — самый ненавязчивый формат рекламы платформы.
 * Полноэкранная/interstitial реклама между сессиями намеренно не
 * используется: она противоречит цели раздела 1 (снижение возбуждения
 * перед сном игрока), поэтому в этой игре не подключается.
 */
export async function showStickyBanner() {
  const ysdk = await getSdk();
  try {
    await ysdk?.adv?.showBannerAdv?.();
  } catch {
    // реклама недоступна/заблокирована — игра продолжает работать без неё
  }
}
