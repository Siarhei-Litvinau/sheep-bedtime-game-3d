import * as THREE from 'three';

// FOV в THREE.PerspectiveCamera — вертикальный; вся сцена (забор ±10 по X,
// амбар, NPC) расставлена и подобрана под ландшафтный экран. На портретной
// мобильной ориентации (aspect < 1) при фиксированном вертикальном FOV
// горизонтальный обзор резко сужается — забор и часть сцены обрезаются по
// бокам. fovForAspect() растит вертикальный FOV для узких экранов так, чтобы
// приблизить горизонтальный обзор к тому, что виден на опорном 16:9
// (не восстанавливает его один-в-один — на очень узких экранах это дало бы
// >100° и заметный fisheye — MAX_FOV ограничивает перекос).
const BASE_FOV = 50; // вертикальный FOV на опорном landscape-соотношении и в close-up ракурсах CameraRig
const REFERENCE_ASPECT = 16 / 9; // соотношение, под которое расставлена сцена (раздел 2 ревизии)
const MAX_FOV = 90;

/**
 * FOV для общего плана (FLOCK_VIEW/RETURN_TO_FLOCK) — растёт на узких
 * портретных экранах, чтобы забор/амбар/отара не обрезались по бокам.
 * **Не используется** для close-up ракурсов CameraRig (SHEEP_SELECTED/
 * JUMP_CINEMATIC, см. CLOSE_UP_FOV) — там камера стоит вплотную к сцене
 * (трава/деревья у объектива), и тот же рост FOV даёт заметный fisheye на
 * ближних объектах, ломая заранее подобранную композицию кадра.
 */
export function fovForAspect(aspect) {
  if (aspect >= REFERENCE_ASPECT) return BASE_FOV;
  const baseFovRad = THREE.MathUtils.degToRad(BASE_FOV);
  const referenceHorizontalFov = 2 * Math.atan(Math.tan(baseFovRad / 2) * REFERENCE_ASPECT);
  const targetVerticalFov = 2 * Math.atan(Math.tan(referenceHorizontalFov / 2) / aspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(targetVerticalFov), BASE_FOV, MAX_FOV);
}

/** FOV close-up ракурсов CameraRig — фиксирован, не зависит от ориентации экрана (см. fovForAspect). */
export const CLOSE_UP_FOV = BASE_FOV;

/**
 * Камера сцены. Зафиксирована near-planet, смотрит на изогнутый горизонт
 * планеты (раздел 5.10) — снизу видна дуга поверхности, сверху небо.
 * Позиция подобрана так, чтобы линия забора (будет добавлен в п.2)
 * читалась примерно на 1/3 высоты кадра.
 */
export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(fovForAspect(aspect), aspect, 0.1, 500);

  // Отодвинута и приподнята относительно исходных (0,7,16)/(0,2.2,0) —
  // раздел 2 ревизии (camera-and-layout-revision.md) раздвинул забор и
  // сместил амбар дальше вглубь тёмной половины; без этого края нового,
  // более широкого забора (±10 по X) обрезались бы кадром. Это только
  // стартовое значение — с раздела 4 ревизии реальным управлением камерой
  // на каждый кадр занимается CameraRig (game/CameraRig.js), эта позиция
  // передаётся ему как цель состояния FLOCK_VIEW.
  camera.position.set(0, 9, 21);
  camera.lookAt(0, 2.6, -1);

  return camera;
}

export function updateCameraAspect(camera, width, height) {
  const aspect = width / height;
  camera.aspect = aspect;
  camera.fov = fovForAspect(aspect);
  camera.updateProjectionMatrix();
}
