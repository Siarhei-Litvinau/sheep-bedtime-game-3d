import * as THREE from 'three';
import { Sheep } from '../world/Sheep.js';
import { SheepAnimator } from './SheepAnimator.js';

const ROW_SIZE = 3; // овец в ряду ожидания
const ROW_SPACING = 0.7;
const COL_SPACING = 0.6;
const JITTER = 0.14;

/**
 * Очередь овец у забора (раздел 3, пункт 11.6). Число овец — функция от
 * длительности сессии (sheepCountForSession). Активна всегда только
 * первая — на ней работает SheepAnimator (она сама подходит от точки
 * выпаса `graze` к забору, см. фазу 'approach') и её слушает ввод игрока;
 * за ней ждёт небольшая отара, выстроенная компактным строем у `graze`,
 * а не длинной цепочкой (чтобы не выезжать за камеру при 12–15 овцах).
 * Когда активная овца скрывается у амбара, очередь подтягивается и
 * следующая овца становится активной — до полного исчерпания.
 */
export class SheepQueue {
  constructor(scene, surfacePoint, waypoints, effects, { count, onWindowLit, onSessionComplete }) {
    this.scene = scene;
    this.surfacePoint = surfacePoint;
    this.waypoints = waypoints;
    this.effects = effects;
    this.onWindowLit = onWindowLit;
    this.onSessionComplete = onSessionComplete;

    this.pending = [];
    for (let i = 0; i < count; i++) {
      const sheep = new Sheep();
      sheep.addTo(scene);
      this.pending.push(sheep);
    }
    this.totalCount = count;

    this.activeSheep = null;
    this.animator = null;

    this._activateNext();
  }

  get remainingCount() {
    return this.pending.length + (this.activeSheep ? 1 : 0);
  }

  _layoutWaitingQueue() {
    // Ждущее стадо пасётся у точки graze — заметно дальше от забора, чем
    // активная овца, которая сама медленно подходит к нему (SheepAnimator
    // 'approach'). Слот 0 — это сама graze-точка, откуда стартует активная.
    const { graze } = this.waypoints;
    this.pending.forEach((sheep, i) => {
      const slot = i + 1;
      const row = Math.floor((slot - 1) / ROW_SIZE) + 1;
      const col = (slot - 1) % ROW_SIZE;
      const jitterX = (pseudoRandom(slot) - 0.5) * JITTER;
      const jitterZ = (pseudoRandom(slot + 100) - 0.5) * JITTER;

      const x = graze.x + (col - (ROW_SIZE - 1) / 2) * COL_SPACING + jitterX;
      const z = graze.z + row * ROW_SPACING + jitterZ;

      sheep.placeOnSurface(this.surfacePoint, x, z, new THREE.Vector3(0.3, 0, -1));
    });
  }

  _activateNext() {
    const sheep = this.pending.shift();
    if (!sheep) {
      this.activeSheep = null;
      this.animator = null;
      this.onSessionComplete?.();
      return;
    }

    this.activeSheep = sheep;
    this.animator = new SheepAnimator(sheep, this.surfacePoint, this.waypoints, this.effects, {
      onArrive: () => this.onWindowLit?.(),
      onComplete: () => this._retireActive(),
    });

    this._layoutWaitingQueue();
  }

  _retireActive() {
    const sheep = this.activeSheep;
    this.activeSheep = null;
    this.animator = null;
    sheep.removeFrom(this.scene);
    sheep.dispose();
    this._activateNext();
  }

  startCharge() {
    this.animator?.startCharge();
  }

  release() {
    this.animator?.release();
  }

  setCyclePace(pace) {
    this.animator?.setCyclePace(pace);
  }

  setResponseIntensity(intensity) {
    this.animator?.setResponseIntensity(intensity);
  }

  setBreathingCpm(cpm) {
    this.animator?.setBreathingCpm(cpm);
  }

  update(dt) {
    this.animator?.update(dt);
  }
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
