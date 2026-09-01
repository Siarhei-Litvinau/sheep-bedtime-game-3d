import * as THREE from 'three';

const CLOUD_COLOR = 0xf5ecdd; // светлый нейтральный, чуть теплее на тёмной половине неба
const FACE_COLOR = 0x4a4038;

const DRIFT_RANGE = 6;
const DRIFT_PERIOD = 42; // сек — независимо от дыхательного ритма (раздел 5.4: намеренный контрапункт)
const YAWN_DURATION = 0.8;
const LOWER_DURATION = 3.0;
const LOWER_AMOUNT = 1.1;

/**
 * NPC 3 — облако с "зевающим" лицом (раздел 5.4). Дрейфует по небу
 * независимо от дыхательного ритма сцены. Тап → yawn → lower_slow
 * (опускается и замедляется); к финалу сессии restOverBarn() останавливает
 * его неподвижно над амбаром.
 */
export class CloudNpc {
  constructor(basePosition) {
    this.group = new THREE.Group();
    this.basePosition = basePosition.clone();
    this.state = 'drift';
    this.driftTime = Math.random() * DRIFT_PERIOD;
    this.driftPhase = Math.random() * Math.PI * 2;
    this.stateT = 0;

    const material = new THREE.MeshBasicMaterial({
      color: CLOUD_COLOR,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const blobOffsets = [
      [0, 0, 0, 0.45],
      [0.4, 0.05, 0, 0.32],
      [-0.4, 0.03, 0, 0.32],
      [0.18, 0.22, 0.05, 0.28],
      [-0.18, 0.2, -0.05, 0.28],
    ];
    for (const [x, y, z, r] of blobOffsets) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), material);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
    }

    const eyeGeometry = new THREE.SphereGeometry(0.035, 6, 5);
    const faceMaterial = new THREE.MeshBasicMaterial({ color: FACE_COLOR });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, faceMaterial);
      eye.position.set(side * 0.13, 0.05, 0.42);
      this.group.add(eye);
    }

    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 8, Math.PI * 0.7), faceMaterial);
    this.mouth.position.set(0, -0.08, 0.43);
    this.mouth.rotation.set(Math.PI, 0, Math.PI * 0.85);
    this.mouth.scale.set(0.5, 0.3, 1);
    this.group.add(this.mouth);

    this._applyDriftPosition();
  }

  onTap() {
    if (this.state !== 'drift') return;
    this.state = 'yawn';
    this.stateT = 0;
  }

  update(dt) {
    switch (this.state) {
      case 'drift':
        this.driftTime += dt;
        this._applyDriftPosition();
        break;
      case 'yawn':
        this._updateYawn(dt);
        break;
      case 'lower_slow':
        this._updateLower(dt);
        break;
      case 'rest_over_barn':
        break; // неподвижна
    }
  }

  _applyDriftPosition() {
    const x = Math.sin(((this.driftTime * Math.PI * 2) / DRIFT_PERIOD) + this.driftPhase) * DRIFT_RANGE;
    const bob = Math.sin(this.driftTime * 0.5 + this.driftPhase) * 0.25;
    this.group.position.set(this.basePosition.x + x, this.basePosition.y + bob, this.basePosition.z);
  }

  _updateYawn(dt) {
    this.stateT += dt / YAWN_DURATION;
    const t = Math.min(this.stateT, 1);
    const open = Math.sin(Math.PI * t);
    this.mouth.scale.set(0.5 + open * 0.3, 0.3 + open * 0.5, 1);

    if (this.stateT >= 1) {
      this.mouth.scale.set(0.5, 0.3, 1);
      this.state = 'lower_slow';
      this.stateT = 0;
      this._lowerStartY = this.group.position.y;
    }
  }

  _updateLower(dt) {
    this.stateT += dt / LOWER_DURATION;
    const t = Math.min(this.stateT, 1);
    this.group.position.y = THREE.MathUtils.lerp(this._lowerStartY, this._lowerStartY - LOWER_AMOUNT, t);

    if (this.stateT >= 1) {
      this.basePosition = this.group.position.clone();
      this.driftTime = 0;
      this.state = 'drift';
    }
  }

  /** К финалу сессии (раздел 5.4) — неподвижно зависает над указанной точкой. */
  restOverBarn(position) {
    this.state = 'rest_over_barn';
    this.group.position.copy(position);
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }
}
