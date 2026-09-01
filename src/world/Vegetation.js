import * as THREE from 'three';
import { orientUpForward } from './surface.js';

const TRUNK_COLOR = 0x2c2018;
const DAY_CROWN_COLOR = 0x5c6b3f;
const NIGHT_CROWN_COLOR = 0x22392f;
const DAY_GRASS_COLOR = 0x55642f;
const NIGHT_GRASS_COLOR = 0x1c2f2a;

const SWAY_AMPLITUDE = THREE.MathUtils.degToRad(2.5); // раздел 5.7: амплитуда ~2–3°
const AXIS_X = new THREE.Vector3(1, 0, 0);

/**
 * Деревья и трава фона (раздел 5.7) — низкополигональные, инстансированные
 * (один InstancedMesh на ствол/крону/траву на каждую сторону планеты).
 * Покачивание — синхронно с текущей скоростью дыхательного цикла сессии
 * (не независимо), с шарниром у земли, а не от центра геометрии.
 */
export class Vegetation {
  constructor(surfacePoint, trees, grassTufts) {
    this.time = 0;
    this.angularFreq = (13.5 / 60) * Math.PI * 2;
    this.sets = [];
    this.group = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.045, 0.065, 0.85, 5);
    const crownGeometry = new THREE.ConeGeometry(0.5, 0.9, 6);
    const grassGeometry = new THREE.ConeGeometry(0.1, 0.22, 4);

    this._addSet(surfacePoint, trees, trunkGeometry, new THREE.MeshLambertMaterial({ color: TRUNK_COLOR }), 0.425);
    this._addSet(
      surfacePoint,
      trees.filter((t) => t.day),
      crownGeometry,
      new THREE.MeshLambertMaterial({ color: DAY_CROWN_COLOR }),
      1.1
    );
    this._addSet(
      surfacePoint,
      trees.filter((t) => !t.day),
      crownGeometry,
      new THREE.MeshLambertMaterial({ color: NIGHT_CROWN_COLOR }),
      1.1
    );
    this._addSet(
      surfacePoint,
      grassTufts.filter((t) => t.day),
      grassGeometry,
      new THREE.MeshLambertMaterial({ color: DAY_GRASS_COLOR }),
      0.11
    );
    this._addSet(
      surfacePoint,
      grassTufts.filter((t) => !t.day),
      grassGeometry,
      new THREE.MeshLambertMaterial({ color: NIGHT_GRASS_COLOR }),
      0.11
    );
  }

  _addSet(surfacePoint, items, geometry, material, lift) {
    if (items.length === 0) return;

    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const entries = items.map((item) => {
      const { position, normal } = surfacePoint(item.x, item.z);
      const baseQuat = orientUpForward(normal, new THREE.Vector3(0, 0, 1));
      return {
        groundPos: position,
        localOffset: new THREE.Vector3(0, lift, 0),
        baseQuat,
        scale: item.scale ?? 1,
        phase: item.phase ?? Math.random() * Math.PI * 2,
      };
    });

    this.group.add(mesh);
    this.sets.push({ mesh, entries, dummy: new THREE.Object3D(), swayQuat: new THREE.Quaternion() });
  }

  /** Текущая скорость дыхательного цикла (циклов/мин) — темп покачивания. */
  setBreathingCpm(cpm) {
    this.angularFreq = (cpm / 60) * Math.PI * 2;
  }

  update(dt) {
    this.time += dt;

    for (const set of this.sets) {
      const { mesh, entries, dummy, swayQuat } = set;
      entries.forEach((e, i) => {
        const angle = SWAY_AMPLITUDE * Math.sin(this.time * this.angularFreq + e.phase);
        swayQuat.setFromAxisAngle(AXIS_X, angle);
        dummy.quaternion.copy(e.baseQuat).multiply(swayQuat);
        // Шарнир у земли: смещение от опоры до центра геометрии поворачиваем
        // вместе с текущим наклоном, а не крутим геометрию вокруг её центра.
        const worldOffset = e.localOffset.clone().applyQuaternion(dummy.quaternion);
        dummy.position.copy(e.groundPos).add(worldOffset);
        dummy.scale.setScalar(e.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }
}
