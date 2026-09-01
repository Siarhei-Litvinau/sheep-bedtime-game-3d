import * as THREE from 'three';

const START = 1.0;
const END = 0.35;

/**
 * Угасающий отклик (раздел 4): визуальный фидбек на действия игрока
 * (свечение при заряде/прыжке, звёздная пыль) становится тише и мягче
 * по ходу сессии — монотонный множитель силы отклика от прогресса.
 */
export function responseIntensityAt(progress) {
  return THREE.MathUtils.lerp(START, END, THREE.MathUtils.clamp(progress, 0, 1));
}
