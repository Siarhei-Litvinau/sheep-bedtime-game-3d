import * as THREE from 'three';
import { orientUpForward } from './surface.js';

const BODY_COLOR = 0x6b4a2f; // приглушённый тёплый охра/коричневый
const EYE_BASE_COLOR = 0x2c1f14;
const EYE_GLOW = new THREE.Color(0xffe08a); // мягкое жёлтое свечение
const BRANCH_COLOR = 0x2c2018;

const DIM_TRANSITION = 0.5; // сек на каждую стадию гашения

/**
 * NPC 1 — сова/светлячок на ветке (раздел 5.2). Фоновый, опциональный.
 * Тап поэтапно гасит свечение глаз: idle_glow → dim_1 → dim_2 → dim_3.
 */
export class OwlFirefly {
  constructor() {
    this.group = new THREE.Group();
    this.stage = 0; // 0 = idle_glow, 3 = полностью погашено

    const bodyMaterial = new THREE.MeshLambertMaterial({ color: BODY_COLOR });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyMaterial);
    body.scale.set(1, 1.05, 0.95);
    body.position.y = 0.34;
    this.group.add(body);

    this.eyeMaterial = new THREE.MeshLambertMaterial({ color: EYE_BASE_COLOR, emissive: EYE_GLOW.clone() });
    const eyeGeometry = new THREE.SphereGeometry(0.055, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.eyeMaterial);
      eye.position.set(side * 0.12, 0.4, -0.26);
      this.group.add(eye);
    }

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 1.1, 5),
      new THREE.MeshLambertMaterial({ color: BRANCH_COLOR })
    );
    branch.rotation.z = Math.PI / 2;
    branch.position.y = 0.03;
    this.group.add(branch);

    this._glowFrom = 1;
    this._glowTo = 1;
    this.transitionT = 1;
  }

  onTap() {
    if (this.stage >= 3) return;
    this.stage += 1;
    this._glowFrom = THREE.MathUtils.lerp(this._glowFrom, this._glowTo, this.transitionT);
    this._glowTo = 1 - this.stage / 3;
    this.transitionT = 0;
  }

  update(dt) {
    if (this.transitionT >= 1) return;
    this.transitionT = Math.min(this.transitionT + dt / DIM_TRANSITION, 1);
    const glow = THREE.MathUtils.lerp(this._glowFrom, this._glowTo, this.transitionT);
    this.eyeMaterial.emissive.copy(EYE_GLOW).multiplyScalar(glow);
  }

  placeOnSurface(surfacePoint, x, z, forwardHint) {
    const { position, normal } = surfacePoint(x, z);
    this.group.position.copy(position);
    this.group.quaternion.copy(orientUpForward(normal, forwardHint));
    return this;
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }
}
