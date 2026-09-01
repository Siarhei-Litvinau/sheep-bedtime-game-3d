// Раздел 3: число овец = функция от длительности сессии.
// Заданы только опорные точки (короткая 5–10 мин → 6–8 овец, полная
// 12–18 мин → 12–15 овец) — между и за их пределами линейно
// интерполируем/клампим, чтобы функция была определена для любой
// длительности, а не только для этих двух диапазонов.
const BREAKPOINTS = [
  [5, 6],
  [10, 8],
  [12, 12],
  [18, 15],
];

/** Число овец сессии по её длительности в минутах. */
export function sheepCountForSession(durationMinutes) {
  if (durationMinutes <= BREAKPOINTS[0][0]) {
    return BREAKPOINTS[0][1];
  }

  for (let i = 0; i < BREAKPOINTS.length - 1; i++) {
    const [d0, c0] = BREAKPOINTS[i];
    const [d1, c1] = BREAKPOINTS[i + 1];
    if (durationMinutes <= d1) {
      const t = (durationMinutes - d0) / (d1 - d0);
      return Math.round(c0 + (c1 - c0) * t);
    }
  }

  return BREAKPOINTS[BREAKPOINTS.length - 1][1];
}
