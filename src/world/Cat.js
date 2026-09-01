import * as THREE from 'three';
import { orientUpForward } from './surface.js';

const BODY_COLOR = 0x2c2438; // тёмный графитово-фиолетовый — впишется в тёмную половину

const CURL_STAGE_DURATION = 0.6;
const BREATH_AMPLITUDE = 0.03;

/**
 * NPC 2 — кот (раздел 5.3). Фоновый, разовая анимация на тап: sitting →
 * curl_1 → curl_2 (сворачивается в клубок) → sleeping (лёгкое дыхание).
 */
export class Cat {
  constructor() {
    this.group = new THREE.Group();
    this.state = 'sitting';
    this.t = 0;

    const material = new THREE.MeshLambertMaterial({ color: BODY_COLOR });

    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), material);
    this.body.position.y = 0.28;
    this.body.scale.set(1, 1, 1.1);
    this.group.add(this.body);
    this._baseBodyY = 0.28;

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), material);
    this.head.position.set(0, 0.5, -0.2);
    this.group.add(this.head);
    this._baseHeadPos = this.head.position.clone();

    const earGeometry = new THREE.ConeGeometry(0.07, 0.14, 4);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeometry, material);
      ear.position.set(side * 0.09, 0.62, -0.2);
      ear.rotation.x = -0.1;
      this.group.add(ear);
    }

    this.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.55, 5), material);
    this.tail.position.set(0, 0.32, 0.32);
    this.tail.rotation.x = -0.9;
    this.group.add(this.tail);
    this._baseTailPos = this.tail.position.clone();
  }

  onTap() {
    if (this.state !== 'sitting') return;
    this.state = 'curl_1';
    this.t = 0;
  }

  update(dt) {
    switch (this.state) {
      case 'curl_1':
      case 'curl_2': {
        this.t += dt / CURL_STAGE_DURATION;
        const stageT = Math.min(this.t, 1);
        // curl_1: 0→0.5 общего сворачивания, curl_2: 0.5→1
        const overall = this.state === 'curl_1' ? stageT * 0.5 : 0.5 + stageT * 0.5;
        this._applyCurl(overall);
        if (this.t >= 1) {
          this.t = 0;
          this.state = this.state === 'curl_1' ? 'curl_2' : 'sleeping';
        }
        break;
      }
      case 'sleeping': {
        this.t += dt;
        const breathe = 1 + Math.sin(this.t * 1.3) * BREATH_AMPLITUDE;
        this.body.scale.set(1.15 * breathe, 0.6 * breathe, 1.15 * breathe);
        break;
      }
    }
  }

  _applyCurl(t) {
    this.body.scale.set(1 + t * 0.15, 1 - t * 0.4, 1.1 - t * 0.1);
    this.body.position.y = this._baseBodyY - t * 0.08;
    this.head.position.set(
      this._baseHeadPos.x,
      this._baseHeadPos.y - t * 0.28,
      this._baseHeadPos.z + t * 0.22
    );
    this.head.scale.setScalar(1 - t * 0.1);
    this.tail.rotation.x = -0.9 - t * 0.9;
    this.tail.position.set(this._baseTailPos.x, this._baseTailPos.y - t * 0.1, this._baseTailPos.z - t * 0.12);
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
