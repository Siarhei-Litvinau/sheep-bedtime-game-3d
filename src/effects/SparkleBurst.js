import * as THREE from 'three';

const PARTICLE_COUNT = 20;
const LIFE = 0.55;

/**
 * Короткая вспышка "звёздной пыли" в пике прыжка (раздел 5.1, фаза `jump`).
 * Каждый вызов spawn() создаёт свой THREE.Points и утилизирует его по
 * истечении жизни — дёшево для редких коротких эффектов.
 */
export class SparkleBurst {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  /** intensity (раздел 4: угасающий отклик) — приглушает яркость/размер к финалу сессии. */
  spawn(position, intensity = 1) {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const theta = Math.random() * Math.PI * 2;
      const speed = (0.35 + Math.random() * 0.55) * (0.6 + 0.4 * intensity);
      velocities.push(
        new THREE.Vector3(Math.cos(theta) * speed, 0.25 + Math.random() * 0.5, Math.sin(theta) * speed)
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xfff3d6,
      size: 0.07 * (0.6 + 0.4 * intensity),
      transparent: true,
      opacity: 0.9 * intensity,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.active.push({ points, velocities, age: 0, baseOpacity: 0.9 * intensity });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const burst = this.active[i];
      burst.age += dt;

      const positions = burst.points.geometry.attributes.position.array;
      for (let p = 0; p < PARTICLE_COUNT; p++) {
        const v = burst.velocities[p];
        positions[p * 3] += v.x * dt;
        positions[p * 3 + 1] += v.y * dt;
        positions[p * 3 + 2] += v.z * dt;
        v.y -= dt * 0.45; // мягкая гравитация
      }
      burst.points.geometry.attributes.position.needsUpdate = true;

      const lifeT = burst.age / LIFE;
      burst.points.material.opacity = Math.max(0, burst.baseOpacity * (1 - lifeT));

      if (burst.age >= LIFE) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        this.active.splice(i, 1);
      }
    }
  }
}
