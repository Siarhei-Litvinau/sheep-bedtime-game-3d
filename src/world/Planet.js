import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vNormal;

  void main() {
    vLocalPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDayColor;
  uniform vec3 uNightColor;
  uniform vec2 uDayDir;
  uniform float uSoftness;

  varying vec3 vLocalPos;
  varying vec3 vNormal;

  void main() {
    vec2 dir = normalize(vLocalPos.xz + 1e-5);
    float side = dot(dir, uDayDir);
    float blend = smoothstep(-uSoftness, uSoftness, side);

    vec3 base = mix(uNightColor, uDayColor, blend);

    // лёгкий вертикальный градиент — макушка планеты чуть светлее основания
    float elevation = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
    base += elevation * 0.06;

    gl_FragColor = vec4(base, 1.0);
  }
`;

/**
 * Планета/горизонт (раздел 5.10). Большая сфера, из которой камера видит
 * только верхний сегмент как изогнутую линию горизонта. Поверхность
 * разделена на две половины (тёплые сумерки / холодная ночь) градиентным
 * "терминатором" — угол терминатора управляется извне (раздел 6).
 */
export class Planet {
  constructor({
    radius = 46, // ↑ было 30 (camera-and-layout-revision.md, п.2) — крупнее планета,
    // при пропорционально раздвинутой композиции (main.js) даёт более
    // выраженный изгиб горизонта и ощущение простора, а не диорамы.
    widthSegments = 48,
    heightSegments = 32,
    dayColor = new THREE.Color(0xf2b98a),
    nightColor = new THREE.Color(0x2e3050),
    terminatorAngle = Math.PI / 2,
    softness = 0.16,
  } = {}) {
    this.radius = radius;

    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);

    this.uniforms = {
      uDayColor: { value: dayColor },
      uNightColor: { value: nightColor },
      uDayDir: { value: new THREE.Vector2(1, 0) },
      uSoftness: { value: softness },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, -radius + 3, 0); // над центром планеты выступает горизонт на y≈3

    this.setTerminatorAngle(terminatorAngle);
  }

  /** Угол (рад) положения границы день/ночь вдоль экватора планеты. */
  setTerminatorAngle(angle) {
    this.uniforms.uDayDir.value.set(Math.cos(angle), Math.sin(angle));
  }

  setSoftness(softness) {
    this.uniforms.uSoftness.value = softness;
  }

  /** Обновляет цвета половин планеты (раздел 6: цветовая/световая кривая сессии). */
  setColors(dayColor, nightColor) {
    this.uniforms.uDayColor.value.copy(dayColor);
    this.uniforms.uNightColor.value.copy(nightColor);
  }

  addTo(scene) {
    scene.add(this.mesh);
    return this;
  }
}
