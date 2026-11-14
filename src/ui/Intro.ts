import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { log, error } from '../core/debug';

export interface IntroCallbacks {
  onComplete: () => void;
}

type Stage = 'wait' | 'video' | 'presents' | 'done';

export class Intro {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly pixelPass: ShaderPass;
  private readonly video: HTMLVideoElement;
  private videoTexture: THREE.VideoTexture | null = null;
  private presentsTexture: THREE.CanvasTexture | null = null;
  private readonly plane: THREE.Mesh;

  private stage: Stage = 'wait';
  private animationId = 0;
  private videoStartTime = 0;
  private readonly videoDurationMs = 15000;
  private presentsStartTime = 0;
  private readonly presentsDurationMs = 4000;
  private readonly presentsFadeMs = 1000;
  private presentsTimer: number | null = null;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly callbacks: IntroCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'intro-root';
    this.root.innerHTML = `<div class="intro-wait"></div>`;

    this.style = document.createElement('style');
    this.style.dataset.introStyle = 'true';
    this.style.textContent = `
      .intro-root {
        position:absolute; inset:0; z-index:30; overflow:hidden;
        background:#000; color:#e8e3ca;
        font-family:'Courier New', monospace;
        display:flex; align-items:center; justify-content:center;
        pointer-events:auto; user-select:none;
      }
      .intro-root [hidden] { display:none !important; }
      .intro-wait {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        background:#000;
      }
    `;

    this.container.style.position = 'relative';
    this.container.appendChild(this.style);
    this.container.appendChild(this.root);

    this.video = document.createElement('video');
    this.video.src = '/intro/ps1.mp4';
    this.video.loop = false;
    this.video.muted = false;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.style.display = 'none';
    this.video.addEventListener('error', () => error('Не удалось загрузить /intro/ps1.mp4'));
    document.body.appendChild(this.video);

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'none';
    this.canvas.style.imageRendering = 'pixelated';
    this.root.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 2.0;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1 });
    this.plane = new THREE.Mesh(geometry, material);
    this.scene.add(this.plane);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

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

    window.addEventListener('keydown', this.handleKeyDown);
    this.root.addEventListener('click', this.handleClick);

    this.resize();
    window.addEventListener('resize', this.resize);

    log('Intro: ждём нажатия (черный экран)');
  }

  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.resize);
    this.root.removeEventListener('click', this.handleClick);

    if (this.presentsTimer !== null) {
      clearTimeout(this.presentsTimer);
      this.presentsTimer = null;
    }

    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.remove();

    this.videoTexture?.dispose();
    this.videoTexture = null;
    this.presentsTexture?.dispose();
    this.presentsTexture = null;

    this.composer.dispose();
    this.renderer.dispose();

    this.root.remove();
    this.style.remove();
  }

  private handleClick = (): void => {
    if (this.stage === 'wait') this.startVideo();
    else if (this.stage === 'video') this.finishVideo();
    else if (this.stage === 'presents') this.finishPresents();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      if (this.stage === 'wait') this.startVideo();
      else if (this.stage === 'video') this.finishVideo();
      else if (this.stage === 'presents') this.finishPresents();
      e.preventDefault();
    }
  };

  private startVideo(): void {
    if (this.stage !== 'wait') return;
    this.stage = 'video';

    const wait = this.root.querySelector<HTMLElement>('.intro-wait');
    if (wait) wait.hidden = true;

    this.canvas.style.display = 'block';

    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    const material = this.plane.material as THREE.MeshBasicMaterial;
    material.map = this.videoTexture;
    material.color.set(0xffffff);
    material.opacity = 1;
    material.needsUpdate = true;

    this.video.currentTime = 0;
    this.video.play().catch(cause => {
      error('Не удалось запустить видео', cause);
      this.finishVideo();
    });

    this.videoStartTime = performance.now();
    this.animate();
    log('Intro: видео играет (15 сек)');
  }

  private finishVideo(): void {
    if (this.stage !== 'video') return;
    this.stage = 'presents';

    this.video.pause();

    this.presentsTexture = this.createPresentsTexture();

    const material = this.plane.material as THREE.MeshBasicMaterial;
    material.map = this.presentsTexture;
    material.color.set(0xffffff);
    material.opacity = 1;
    material.needsUpdate = true;

    this.presentsStartTime = performance.now();
    log('Intro: awake presents (4 сек, fade out)');

    this.presentsTimer = window.setTimeout(() => {
      this.presentsTimer = null;
      this.finishPresents();
    }, this.presentsDurationMs);
  }

  private finishPresents(): void {
    if (this.stage !== 'presents') return;
    this.stage = 'done';

    if (this.presentsTimer !== null) {
      clearTimeout(this.presentsTimer);
      this.presentsTimer = null;
    }

    this.callbacks.onComplete();
  }

  private createPresentsTexture(): THREE.CanvasTexture {
    const width = 640;
    const height = 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      error('Intro: не удалось получить 2d context');
      return new THREE.CanvasTexture(canvas);
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = 'awake presents';
    const fontSize = 28;
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;

    const metrics = ctx.measureText(text);
    const scale = Math.min(1, (width - 40) / metrics.width);
    const finalSize = Math.floor(fontSize * scale);
    ctx.font = `bold ${finalSize}px "Courier New", monospace`;

    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    return texture;
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.videoTexture) this.videoTexture.needsUpdate = true;
    if (this.presentsTexture) this.presentsTexture.needsUpdate = true;

    this.composer.render();

    if (this.stage === 'video') {
      const elapsed = performance.now() - this.videoStartTime;
      if (elapsed >= this.videoDurationMs) this.finishVideo();
    } else if (this.stage === 'presents') {
      const elapsed = performance.now() - this.presentsStartTime;
      const fadeStart = this.presentsDurationMs - this.presentsFadeMs;

      if (elapsed >= this.presentsDurationMs) {
        this.finishPresents();
        return;
      }

      if (elapsed >= fadeStart) {
        const t = (elapsed - fadeStart) / this.presentsFadeMs;
        const material = this.plane.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0, 1 - t);
      }
    }
  };

  private resize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    const lowW = Math.max(1, Math.floor(w * 0.42));
    const lowH = Math.max(1, Math.floor(h * 0.42));

    this.renderer.setSize(lowW, lowH, false);
    this.composer.setSize(lowW, lowH);
    this.pixelPass.uniforms.resolution.value.set(lowW, lowH);

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  };
}