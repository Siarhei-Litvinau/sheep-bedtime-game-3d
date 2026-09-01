import * as THREE from 'three';
import { orientUpForward } from '../world/surface.js';

const MAX_CHARGE = 1.4; // сек удержания, после которых заряд не растёт дальше
const LAND_DURATION = 0.32;
// ↑ с 1.3 (раздел 2 ревизии: main.js раздвинул land→walkTo примерно в 2 раза) —
// без этого овца проезжала бы удлинённый путь к амбару с той же длительностью,
// то есть заметно быстрее, а должен читаться заметный отрезок пути, не рывок.
const WALK_DURATION = 2.6;
const YAWN_DURATION = 0.5;
const FADE_DURATION = 0.6;
const RESET_PAUSE = 0.4;

const GLOW_COLOR = new THREE.Color(0xffd9a0);
const BLACK = new THREE.Color(0x000000);

const DEFAULT_BREATHING_CPM = 13.5; // средняя стартовая скорость (раздел 3), пока сессия не запущена

/**
 * Управляет 4 фазами прыжка одной овцы из очереди (раздел 4, SheepQueue)
 * поверх состояний из раздела 5.1: idle → charge → jump → land →
 * walk_sleepy → yawn → fade → done. Одноразовый: по завершении зовёт
 * callbacks.onComplete() вместо повторного цикла (когда onComplete не
 * задан — зацикливается сама, это удобно для точечного тестирования).
 * Темп фаз jump/land/walk/yawn/fade и частота дыхания в idle управляются
 * извне кривой замедления дыхательного цикла (раздел 3) через
 * setCyclePace()/setBreathingCpm() — вызывается каждый кадр из main.js.
 */
export class SheepAnimator {
  constructor(sheep, surfacePoint, { start, land, walkTo }, effects, callbacks = {}) {
    this.sheep = sheep;
    this.surfacePoint = surfacePoint;
    this.start = start;
    this.land = land;
    this.walkTo = walkTo;
    this.effects = effects;
    this.callbacks = callbacks;

    // множитель длительностей фаз jump/land/walk/yawn/fade: 1 = темп старта
    // сессии, меньше — сессия замедлилась (раздел 3, кривая дыхания).
    this.cyclePace = 1;
    // текущая скорость дыхательного цикла (циклов/мин) — определяет частоту
    // покачивания в idle напрямую (раздел 5.1: "в такт дыхательному ритму").
    this.breathingCpm = DEFAULT_BREATHING_CPM;
    // угасающий отклик (раздел 4): множитель силы свечения при заряде/прыжке
    // и звёздной пыли — 1 в начале сессии, тише к финалу.
    this.responseIntensity = 1;

    const dir = new THREE.Vector3(land.x - start.x, 0, land.z - start.z);
    this.forwardHint = dir.lengthSq() > 0 ? dir.normalize() : new THREE.Vector3(0, 0, -1);

    this.baseBodyScale = sheep.body.scale.clone();

    this.state = 'idle';
    this.t = 0;
    this.holdTime = 0;
    this.jumpDuration = 0.8;
    this.jumpHeight = 1.1;
    this.sparkleSpawned = false;
    this._lastNormal = new THREE.Vector3(0, 1, 0);

    this._applyTransform(start.x, start.z, 0);
  }

  /** Множитель темпа фаз (0..1+), от текущей скорости дыхательного цикла сессии. */
  setCyclePace(pace) {
    this.cyclePace = pace;
  }

  /** Угасающий отклик (раздел 4): 1 = полная сила, → тише к финалу сессии. */
  setResponseIntensity(intensity) {
    this.responseIntensity = intensity;
  }

  /** Текущая скорость дыхательного цикла (циклов/мин) — двигает частоту idle-покачивания. */
  setBreathingCpm(cpm) {
    this.breathingCpm = cpm;
  }

  get isIdle() {
    return this.state === 'idle';
  }

  startCharge() {
    if (this.state !== 'idle') return;
    this.state = 'charge';
    this.holdTime = 0;
  }

  release() {
    if (this.state !== 'charge') return;
    const chargeT = Math.min(this.holdTime / MAX_CHARGE, 1);
    this.jumpHeight = 0.9 + chargeT * 0.7;
    // ↑ база и разброс с 0.65/0.35 (раздел 2 ревизии: start→land стал заметно
    // длиннее) — сохраняет прежнюю горизонтальную скорость прыжка на новой
    // дистанции, иначе овца пролетала бы её неестественно быстро.
    this.jumpDuration = 0.85 + chargeT * 0.46;
    this.state = 'jump';
    this.t = 0;
    this.sparkleSpawned = false;
  }

  update(dt) {
    const scaledDt = dt * this.cyclePace;
    switch (this.state) {
      case 'idle':
        this._updateIdle(dt);
        break;
      case 'charge':
        this._updateCharge(dt); // заряд идёт в реальном времени — держит игрок, а не сессия
        break;
      case 'jump':
        this._updateJump(scaledDt);
        break;
      case 'land':
        this._updateLand(scaledDt);
        break;
      case 'walk':
        this._updateWalk(scaledDt);
        break;
      case 'yawn':
        this._updateYawn(scaledDt);
        break;
      case 'fade':
        this._updateFade(scaledDt);
        break;
      case 'resetPause':
        this._updateResetPause(scaledDt);
        break;
    }
  }

  _applyTransform(x, z, normalLift) {
    const { position, normal } = this.surfacePoint(x, z);
    position.addScaledVector(normal, normalLift);
    this.sheep.group.position.copy(position);
    this.sheep.group.quaternion.copy(orientUpForward(normal, this.forwardHint));
    this._lastNormal = normal;
  }

  _updateIdle(dt) {
    this.t += dt;
    // Частота покачивания — напрямую из текущей скорости дыхательного
    // цикла сессии (раздел 3): циклов/мин → рад/сек.
    const angularFreq = (this.breathingCpm / 60) * Math.PI * 2;
    const bob = Math.sin(this.t * angularFreq) * 0.015;
    this._applyTransform(this.start.x, this.start.z, bob);
  }

  _updateCharge(dt) {
    this.holdTime += dt;
    const chargeT = Math.min(this.holdTime / MAX_CHARGE, 1);
    const squat = 0.22 * chargeT;
    this.sheep.body.scale.set(
      this.baseBodyScale.x,
      this.baseBodyScale.y * (1 - squat),
      this.baseBodyScale.z
    );
    this.sheep.bodyMaterial.emissive.copy(BLACK).lerp(GLOW_COLOR, chargeT * 0.55 * this.responseIntensity);
    this._applyTransform(this.start.x, this.start.z, -0.05 * chargeT);
  }

  _updateJump(dt) {
    this.t += dt / this.jumpDuration;
    const t = Math.min(this.t, 1);
    const x = THREE.MathUtils.lerp(this.start.x, this.land.x, t);
    const z = THREE.MathUtils.lerp(this.start.z, this.land.z, t);
    const arc = 4 * this.jumpHeight * t * (1 - t);
    this._applyTransform(x, z, arc);

    const stretch = Math.sin(Math.PI * t);
    this.sheep.body.scale.set(
      this.baseBodyScale.x * (1 - 0.15 * stretch),
      this.baseBodyScale.y * (1 + 0.35 * stretch),
      this.baseBodyScale.z * (1 - 0.15 * stretch)
    );
    this.sheep.bodyMaterial.emissive.copy(BLACK).lerp(GLOW_COLOR, 0.3 * (1 - t) * this.responseIntensity);

    if (!this.sparkleSpawned && t >= 0.45) {
      this.sparkleSpawned = true;
      const peakPos = this.sheep.group.position.clone().addScaledVector(this._lastNormal, 0.4);
      this.effects.sparkles.spawn(peakPos, this.responseIntensity);
    }

    if (this.t >= 1) {
      this.state = 'land';
      this.t = 0;
    }
  }

  _updateLand(dt) {
    this.t += dt / LAND_DURATION;
    const t = Math.min(this.t, 1);
    const squash = Math.sin(Math.PI * t);
    this.sheep.body.scale.set(
      this.baseBodyScale.x * (1 + 0.18 * squash),
      this.baseBodyScale.y * (1 - 0.32 * squash),
      this.baseBodyScale.z * (1 + 0.18 * squash)
    );
    this.sheep.bodyMaterial.emissive.lerp(BLACK, 0.2);
    this._applyTransform(this.land.x, this.land.z, 0);

    if (this.t >= 1) {
      this.sheep.body.scale.copy(this.baseBodyScale);
      this.sheep.bodyMaterial.emissive.copy(BLACK);
      this.state = 'walk';
      this.t = 0;
    }
  }

  _updateWalk(dt) {
    this.t += dt / WALK_DURATION;
    const t = Math.min(this.t, 1);
    const x = THREE.MathUtils.lerp(this.land.x, this.walkTo.x, t);
    const z = THREE.MathUtils.lerp(this.land.z, this.walkTo.z, t);
    const cycles = 2.5;
    const envelope = 1 - t; // замедляющиеся циклы ходьбы (раздел 5.1: walk_sleepy)
    const bob = Math.abs(Math.sin(t * cycles * Math.PI * 2)) * 0.05 * envelope;
    this._applyTransform(x, z, bob);
    this.sheep.head.rotation.x = THREE.MathUtils.lerp(0, 0.35, t);

    if (this.t >= 1) {
      this.state = 'yawn';
      this.t = 0;
    }
  }

  _updateYawn(dt) {
    this.t += dt / YAWN_DURATION;
    const t = Math.min(this.t, 1);
    const open = Math.sin(Math.PI * t);
    this.sheep.head.scale.set(1 + open * 0.12, 1 + open * 0.18, 1 + open * 0.12);
    this._applyTransform(this.walkTo.x, this.walkTo.z, 0);

    if (this.t >= 1) {
      this.sheep.head.scale.set(1, 1, 1);
      this.state = 'fade';
      this.t = 0;
      this.callbacks.onArrive?.(); // овца скрывается у двери — амбар зажигает окно
    }
  }

  _updateFade(dt) {
    // Овца растворяется у двери амбара (раздел 5.5).
    this.t += dt / FADE_DURATION;
    const t = Math.min(this.t, 1);
    const opacity = 1 - t;
    this.sheep.bodyMaterial.opacity = opacity;
    this.sheep.darkMaterial.opacity = opacity;

    if (this.t >= 1) {
      this.state = 'resetPause';
      this.t = 0;
    }
  }

  _updateResetPause(dt) {
    this.t += dt;
    if (this.t >= RESET_PAUSE) {
      if (this.callbacks.onComplete) {
        // Овца одноразовая (очередь у забора, раздел 3/11.6) — дальше ей
        // управляет SheepQueue, сама на idle не зацикливается.
        this.state = 'done';
        this.callbacks.onComplete();
      } else {
        this._reset();
      }
    }
  }

  _reset() {
    this.sheep.bodyMaterial.opacity = 1;
    this.sheep.darkMaterial.opacity = 1;
    this.sheep.bodyMaterial.emissive.copy(BLACK);
    this.sheep.body.scale.copy(this.baseBodyScale);
    this.sheep.head.scale.set(1, 1, 1);
    this.sheep.head.rotation.x = 0;
    this.state = 'idle';
    this.t = 0;
    this._applyTransform(this.start.x, this.start.z, 0);
  }
}
