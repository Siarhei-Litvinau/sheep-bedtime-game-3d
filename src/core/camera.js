import * as THREE from 'three';

/**
 * Камера сцены. Зафиксирована near-planet, смотрит на изогнутый горизонт
 * планеты (раздел 5.10) — снизу видна дуга поверхности, сверху небо.
 * Позиция подобрана так, чтобы линия забора (будет добавлен в п.2)
 * читалась примерно на 1/3 высоты кадра.
 */
export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);

  camera.position.set(0, 7, 16);
  camera.lookAt(0, 2.2, 0);

  return camera;
}

export function updateCameraAspect(camera, width, height) {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
