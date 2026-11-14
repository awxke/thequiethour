import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// PS1-эффект: пикселизация + дизеринг Байера 4x4 + квантование цвета
export class PostProcessing {
  public readonly composer: EffectComposer;
  private readonly pixelPass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.pixelPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(640, 360) },
        pixelSize: { value: 1.6 },
        colorLevels: { value: 16.0 },
        ditherStrength: { value: 0.34 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float pixelSize;
        uniform float colorLevels;
        uniform float ditherStrength;

        varying vec2 vUv;

        float bayer4(vec2 position) {
          int x = int(mod(position.x, 4.0));
          int y = int(mod(position.y, 4.0));
          int index = x + y * 4;

          float matrix[16];
          matrix[0] = 0.0;  matrix[1] = 8.0;  matrix[2] = 2.0;  matrix[3] = 10.0;
          matrix[4] = 12.0; matrix[5] = 4.0;  matrix[6] = 14.0; matrix[7] = 6.0;
          matrix[8] = 3.0;  matrix[9] = 11.0; matrix[10] = 1.0; matrix[11] = 9.0;
          matrix[12] = 15.0; matrix[13] = 7.0; matrix[14] = 13.0; matrix[15] = 5.0;

          return matrix[index] / 16.0;
        }

        void main() {
          vec2 pixelCount = resolution / pixelSize;
          vec2 pixelUv = floor(vUv * pixelCount) / pixelCount;
          vec3 color = texture2D(tDiffuse, pixelUv).rgb;

          vec2 pixelPosition = floor(vUv * pixelCount);
          float dither = bayer4(pixelPosition) - 0.5;
          color += dither * (ditherStrength / colorLevels);
          color = floor(clamp(color, 0.0, 1.0) * colorLevels) / colorLevels;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.composer.addPass(this.pixelPass);
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.pixelPass.uniforms.resolution.value.set(width, height);
  }

  public render(): void {
    this.composer.render();
  }

  public dispose(): void {
    this.composer.dispose();
  }
}