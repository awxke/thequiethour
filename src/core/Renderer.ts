import * as THREE from 'three';
import { PostProcessing } from '../graphics/PostProcessing';

// WebGLRenderer + composer + resize. Держит canvas и знает, как его масштабировать
export class Renderer {
  public readonly webgl: THREE.WebGLRenderer;
  public readonly post: PostProcessing;
  private readonly resolutionScale = 0.42;

  constructor(
    private readonly container: HTMLDivElement,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.webgl = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });

    this.webgl.setPixelRatio(1);
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.BasicShadowMap;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 2.1;

    this.container.appendChild(this.webgl.domElement);

    this.post = new PostProcessing(this.webgl, scene, camera);
  }

  public resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const lowWidth = Math.max(1, Math.floor(width * this.resolutionScale));
    const lowHeight = Math.max(1, Math.floor(height * this.resolutionScale));

    this.webgl.setSize(lowWidth, lowHeight, false);
    this.post.setSize(lowWidth, lowHeight);

    this.webgl.domElement.style.width = '100%';
    this.webgl.domElement.style.height = '100%';
  }

  public render(): void {
    this.post.render();
  }

  public dispose(): void {
    this.post.dispose();
    this.webgl.dispose();
    if (this.webgl.domElement.parentElement === this.container) {
      this.container.removeChild(this.webgl.domElement);
    }
  }
}