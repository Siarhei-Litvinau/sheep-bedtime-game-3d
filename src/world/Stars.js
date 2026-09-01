import * as THREE from 'three';

const STAR_COLOR = new THREE.Color(0xfff2dd); // тёплый неяркий белый, не холодный синий

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;

  uniform float uTime;
  uniform float uAngularFreq;

  varying float vTwinkle;

  void main() {
    vTwinkle = 0.72 + 0.28 * sin(uTime * uAngularFreq + aPhase);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * vTwinkle * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * vTwinkle;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Звёзды (раздел 5.9) — Points-система, весь звёздный слой в один
 * draw call. Мерцание яркости синхронно с текущей скоростью дыхательного
 * цикла сессии (setBreathingCpm), с мягкой амплитудой и случайной фазой
 * на каждую звезду, чтобы мерцание читалось органично, а не строем.
 */
export class Stars {
  constructor({ count = 420 } = {}) {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const nightSide = Math.random() > 0.12; // немного звёзд заходит и на тёплую сторону — не резкая граница
      const spread = (Math.random() * 2 - 1) * 42;
      positions[i * 3] = nightSide ? -Math.abs(spread) - 4 : Math.abs(spread);
      positions[i * 3 + 1] = 6 + Math.random() * 38;
      positions[i * 3 + 2] = -28 + Math.random() * 55;

      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.0 + Math.random() * 1.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uAngularFreq: { value: (13.5 / 60) * Math.PI * 2 },
      uColor: { value: STAR_COLOR },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
  }

  /** Текущая скорость дыхательного цикла (циклов/мин) — темп мерцания. */
  setBreathingCpm(cpm) {
    this.uniforms.uAngularFreq.value = (cpm / 60) * Math.PI * 2;
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }

  addTo(scene) {
    scene.add(this.points);
    return this;
  }
}
