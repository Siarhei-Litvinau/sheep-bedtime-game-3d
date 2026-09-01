import * as THREE from 'three';

import { fovForAspect, CLOSE_UP_FOV } from '../core/camera.js';

const POS_SMOOTH = 2.4; // 1/сек — скорость экспоненциального сглаживания позиции камеры
const LOOK_SMOOTH = 3.2; // цель камеры "догоняет" чуть быстрее позиции — меньше ощущение запаздывания
const FOV_SMOOTH = 3.2; // тот же темп, что и LOOK_SMOOTH — зум синхронен со сменой цели взгляда

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Камера как конечный автомат из 4 состояний (camera-and-layout-revision.md,
 * раздел 4, адаптировано под фактическую механику — см. ниже). Переходы
 * между состояниями не переключают камеру резко — каждое состояние лишь
 * задаёт "желаемую" позицию/цель, а update() каждый кадр подтягивает
 * реальную камеру к желаемой экспоненциальным сглаживанием
 * (framerate-independent lerp), это и даёт плавный tween без ключевых кадров.
 *
 * Камера приближается к овце (SHEEP_SELECTED/JUMP_CINEMATIC) только на время
 * заряда и самого прыжка — как только овца приземлилась и уходит к амбару
 * (land/walk/yawn), камера сразу отъезжает обратно к общему плану
 * (RETURN_TO_FLOCK), не дожидаясь fade. Пока овца сама идёт от точки выпаса
 * к забору (фаза 'approach'), камера тоже держит общий план (FLOCK_VIEW,
 * через default-ветку cameraStateForSheepPhase).
 *
 * Известное отклонение от буквального текста раздела 4: SHEEP_SELECTED в
 * доке подразумевает, что игрок тапает овцу в стаде и она идёт к забору.
 * В текущей механике "выбор" — это начало заряда прыжка (pointerdown/тап
 * рядом с овцой) уже после того, как она сама дошла до забора (approach).
 * SHEEP_SELECTED соответствует состоянию 'charge' аниматора. См.
 * CAMERA_CONTEXT.md (после /clear) для деталей.
 *
 * Доворот планеты вслед за овцой (упомянут в разделе 4 как "можно") — не
 * реализован в этом проходе, см. CAMERA_CONTEXT.md.
 */
export class CameraRig {
  constructor(camera, { flockPosition, flockLookAt, forwardDir }) {
    this.camera = camera;
    this.state = 'FLOCK_VIEW';

    this.flockPosition = flockPosition.clone();
    this.flockLookAt = flockLookAt.clone();

    // Мировая ось "светлая половина → тёмная половина" (раздел 1 ревизии,
    // забор/овцы всегда прыгают вдоль неё). Перпендикуляр к ней — "бок"
    // сцены, небольшое смещение по которому даёт камере лёгкий трёхчетвертной
    // ракурс на овцу вместо вида строго из-за спины.
    this.forward = forwardDir.clone();
    this.forward.y = 0;
    this.forward.normalize();
    this.side = new THREE.Vector3(-this.forward.z, 0, this.forward.x).normalize();

    this._desiredPos = this.flockPosition.clone();
    this._desiredLookAt = this.flockLookAt.clone();
    this._currentLookAt = this.flockLookAt.clone();
    this._bobT = 0;

    camera.position.copy(this.flockPosition);
    camera.lookAt(this.flockLookAt);
  }

  setState(state) {
    this.state = state;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} [sheepPosition] — позиция активной овцы, нужна во всех состояниях кроме FLOCK_VIEW/RETURN_TO_FLOCK
   * @param {THREE.Vector3} [sheepNormal] — нормаль поверхности под овцой (заменяет мировой "верх" на изгиб планеты)
   * @param {number} [jumpProgress] — 0..1, только для JUMP_CINEMATIC (zoom-out на пике дуги)
   * @param {number} [breathingCpm] — текущий темп дыхательного цикла сессии, задаёт частоту едва заметного покачивания в FLOCK_VIEW
   */
  update(dt, { sheepPosition, sheepNormal, jumpProgress = 0, breathingCpm = 13.5 } = {}) {
    this._bobT += dt;
    const up = sheepNormal || WORLD_UP;

    switch (this.state) {
      case 'SHEEP_SELECTED':
        // Смещения x2 от исходных (было forward -3.4/side 2.6/up 2.4) —
        // приближение камеры вдвое слабее, чтобы не читалось агрессивно.
        this._desiredPos
          .copy(sheepPosition)
          .addScaledVector(this.forward, -6.8)
          .addScaledVector(this.side, 5.2)
          .addScaledVector(up, 4.8);
        this._desiredLookAt.copy(sheepPosition).addScaledVector(up, 0.5);
        break;

      case 'JUMP_CINEMATIC': {
        // Тот же ракурс, что и SHEEP_SELECTED (позади и сверху овцы) — камера
        // следует за прыжком, а не уходит в сторону на профильный план (это
        // читалось как "камера едет вправо", а не как слежение за овцой).
        // Единственная разница с зарядом — лёгкий отъезд на пике дуги прыжка
        // (тот же колокол 4·t·(1-t), что задаёт высоту дуги в
        // SheepAnimator._updateJump), для ощущения полёта без смены угла обзора.
        const t = Math.max(0, Math.min(jumpProgress, 1));
        const arcEnvelope = 4 * t * (1 - t);
        const zoomOut = 1 + arcEnvelope * 0.35;
        this._desiredPos
          .copy(sheepPosition)
          .addScaledVector(this.forward, -6.8 * zoomOut)
          .addScaledVector(this.side, 5.2 * zoomOut)
          .addScaledVector(up, 4.8 * zoomOut);
        this._desiredLookAt.copy(sheepPosition).addScaledVector(up, 0.5);
        break;
      }

      case 'RETURN_TO_FLOCK':
      case 'FLOCK_VIEW':
      default: {
        const angularFreq = (breathingCpm / 60) * Math.PI * 2;
        this._desiredPos.copy(this.flockPosition);
        this._desiredPos.y += Math.sin(this._bobT * angularFreq) * 0.12;
        this._desiredLookAt.copy(this.flockLookAt);
        break;
      }
    }

    const posAlpha = 1 - Math.exp(-POS_SMOOTH * dt);
    const lookAlpha = 1 - Math.exp(-LOOK_SMOOTH * dt);
    this.camera.position.lerp(this._desiredPos, posAlpha);
    this._currentLookAt.lerp(this._desiredLookAt, lookAlpha);
    this.camera.lookAt(this._currentLookAt);

    // Мобильная адаптация (портретная ориентация): широкий план растит FOV
    // на узких экранах (core/camera.js → fovForAspect), close-up — держит
    // фиксированный CLOSE_UP_FOV, иначе тот же рост FOV дал бы fisheye на
    // траве/деревьях вплотную к объективу в SHEEP_SELECTED/JUMP_CINEMATIC.
    const isCloseUp = this.state === 'SHEEP_SELECTED' || this.state === 'JUMP_CINEMATIC';
    const desiredFov = isCloseUp ? CLOSE_UP_FOV : fovForAspect(this.camera.aspect);
    const fovAlpha = 1 - Math.exp(-FOV_SMOOTH * dt);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, fovAlpha);
    this.camera.updateProjectionMatrix();
  }
}

/**
 * Состояние камеры для текущей фазы SheepAnimator (раздел 4 ревизии, сводная
 * таблица). Камера приближается только на 'charge'/'jump' — начиная с
 * 'land' (сразу после приземления, когда овца уходит к амбару) она уже
 * отъезжает обратно к общему плану, как и на fade/resetPause. Фаза
 * 'approach' (овца идёт от выпаса к забору) и 'idle' попадают в default —
 * тоже общий план.
 */
export function cameraStateForSheepPhase(animatorState) {
  switch (animatorState) {
    case 'charge':
      return 'SHEEP_SELECTED';
    case 'jump':
      return 'JUMP_CINEMATIC';
    case 'land':
    case 'walk':
    case 'yawn':
    case 'fade':
    case 'resetPause':
      return 'RETURN_TO_FLOCK';
    case 'approach':
    case 'idle':
    default:
      return 'FLOCK_VIEW';
  }
}
