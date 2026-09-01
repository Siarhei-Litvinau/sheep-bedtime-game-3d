import * as THREE from 'three';

/**
 * Освещение сцены (раздел 7): один направленный источник (солнце/луна)
 * + мягкий fill-свет (hemisphere). Без PBR, без динамических теней —
 * flat/toon-friendly схема, дешёвая на мобильных.
 *
 * Настройки цвета/интенсивности здесь — стартовые для базовой сцены;
 * управление кривой день→ночь (раздел 6) подключится позже через update().
 */
export function createLighting(scene) {
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.2);
  sun.position.set(14, 16, 6); // над тёплой (светлой, x>0) половиной планеты
  sun.target.position.set(0, 0, 0);
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.HemisphereLight(0x8fa8c9, 0x2a2230, 0.55);
  scene.add(fill);

  return { sun, fill };
}
