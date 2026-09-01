import * as THREE from 'three';

/**
 * Создаёт WebGLRenderer, привязанный к canvas сцены, и следит за resize/DPR.
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Flat/toon-подход (раздел 7): без филмик-тонмаппинга, чтобы plain-цвета
  // материалов не давились HDR-роллоффом — важно для тёмной ночной половины.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false; // раздел 7: baked/статичные тени, без динамических shadow maps

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    return { width, height };
  }

  return { renderer, resize };
}
