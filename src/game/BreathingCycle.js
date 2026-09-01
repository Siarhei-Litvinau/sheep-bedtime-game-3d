const CPM_RANGE = [12, 15]; // стартовая скорость цикла, циклов/мин
const STEP_CPM = 0.5; // шаг замедления
const FINAL_CPM = 6; // финальная скорость цикла

/**
 * Кривая замедления дыхательного цикла (раздел 3) — управляющий параметр
 * сессии. Ступенчато и монотонно снижает скорость с 12–15 до 6 циклов/мин,
 * только в одну сторону, без ускорений/колебаний назад.
 *
 * Длительность сессии — настраиваемый параметр: интервал между шагами
 * вычисляется от неё так, чтобы кривая доходила до финальной скорости
 * ровно к концу сессии (раздел 3 даёт «~2 минуты» как ориентир для
 * референсной сессии; здесь это не хардкодится, а выводится из
 * sessionDurationSec, иначе короткие сессии просто не успевали бы
 * добраться до финального темпа).
 */
export class BreathingCycle {
  constructor({ sessionDurationSec, startCpm } = {}) {
    this.sessionDurationSec = Math.max(sessionDurationSec ?? 12 * 60, 60);
    this.startCpm = startCpm ?? randomStart();
    this.baseCycleDuration = 60 / this.startCpm;
    this.steps = buildSteps(this.startCpm, this.sessionDurationSec);
  }

  /** Скорость цикла (циклов/мин) на момент elapsedSec от начала сессии. */
  cpmAt(elapsedSec) {
    let cpm = this.steps[0].cpm;
    for (const step of this.steps) {
      if (elapsedSec < step.atSec) break;
      cpm = step.cpm;
    }
    return cpm;
  }

  /** Длительность одного цикла (сек) на момент elapsedSec. */
  cycleDurationAt(elapsedSec) {
    return 60 / this.cpmAt(elapsedSec);
  }

  /** Множитель темпа относительно старта сессии (1 = старт, → 0.4 к финалу). */
  paceAt(elapsedSec) {
    return this.cpmAt(elapsedSec) / this.startCpm;
  }

  /** Прогресс сессии 0..1 (пригодится цветовой/световой кривой, раздел 6). */
  progressAt(elapsedSec) {
    return Math.min(elapsedSec / this.sessionDurationSec, 1);
  }
}

function buildSteps(startCpm, sessionDurationSec) {
  const totalSteps = Math.max(1, Math.round((startCpm - FINAL_CPM) / STEP_CPM));
  const interval = sessionDurationSec / totalSteps;

  const steps = [{ atSec: 0, cpm: startCpm }];
  let cpm = startCpm;
  for (let i = 1; i <= totalSteps; i++) {
    cpm = Math.max(FINAL_CPM, cpm - STEP_CPM);
    steps.push({ atSec: i * interval, cpm });
  }
  return steps;
}

function randomStart() {
  return CPM_RANGE[0] + Math.random() * (CPM_RANGE[1] - CPM_RANGE[0]);
}
