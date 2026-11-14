import * as THREE from 'three';

export type BrightnessMode = 'normal' | 'bright' | 'veryBright';

interface BrightnessPreset {
  exposure: number;
  ambient: number;
  ceiling: number;
  window: number;
  fill: number;
  front: number;
}

// все источники света комнаты + свеча + плавная интерполяция яркости
export class Lighting {
  public readonly ambient: THREE.HemisphereLight;
  public readonly candleAmbient: THREE.HemisphereLight;
  public readonly ceiling: THREE.PointLight;
  public readonly window: THREE.PointLight;
  public readonly fill: THREE.PointLight;
  public readonly front: THREE.PointLight;
  public readonly candleLight: THREE.PointLight;

  private readonly presets: Record<BrightnessMode, BrightnessPreset> = {
    normal: {
      exposure: 1.65,
      ambient: 2.0,
      ceiling: 2.8,
      window: 5.8,
      fill: 2.6,
      front: 2.2
    },
    bright: {
      exposure: 1.85,
      ambient: 2.4,
      ceiling: 3.6,
      window: 7.5,
      fill: 3.2,
      front: 3.0
    },
    veryBright: {
      exposure: 2.0,
      ambient: 2.8,
      ceiling: 4.2,
      window: 8.5,
      fill: 3.8,
      front: 3.6
    }
  };

  private target: BrightnessPreset;
  private candleOn = false;
  private candleFlickerTime = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.Camera
  ) {
    this.ambient = new THREE.HemisphereLight(0xc5d8ff, 0x777b91, 2.5);
    scene.add(this.ambient);

    this.candleAmbient = new THREE.HemisphereLight(0xffd6a0, 0x49301c, 0);
    scene.add(this.candleAmbient);

    this.ceiling = new THREE.PointLight(0xe1eaff, 4.0, 30, 1.0);
    this.ceiling.position.set(0, 3.5, 0);
    this.ceiling.castShadow = true;
    this.ceiling.shadow.mapSize.set(1024, 1024);
    scene.add(this.ceiling);

    this.window = new THREE.PointLight(0x9fc5ff, 9.0, 35, 1.0);
    this.window.position.set(0, 2.5, -5.0);
    this.window.castShadow = true;
    this.window.shadow.mapSize.set(1024, 1024);
    scene.add(this.window);

    this.fill = new THREE.PointLight(0xb2c9ff, 3.5, 28, 1.0);
    this.fill.position.set(3, 2.5, 2);
    scene.add(this.fill);

    this.front = new THREE.PointLight(0xffffff, 3.5, 25, 1.0);
    this.front.position.set(-3, 2.5, 3);
    scene.add(this.front);

    // свеча: свет привязан к камере, летит вместе с игроком
    this.candleLight = new THREE.PointLight(0xffc879, 0, 20, 1.8);
    this.candleLight.position.set(0.39, -0.13, -0.80);
    this.candleLight.castShadow = false;
    camera.add(this.candleLight);

    this.target = { ...this.presets.veryBright };
  }

  public setBrightness(mode: BrightnessMode): void {
    this.target = { ...this.presets[mode] };
  }

  public setCandleMode(on: boolean): void {
    this.candleOn = on;
    this.candleAmbient.intensity = on ? 0.18 : 0;
    this.candleLight.intensity = on ? 16 : 0;
    this.candleLight.distance = on ? 20 : 0;
  }

  public update(delta: number): void {
    const speed = 2;

    this.renderer.toneMappingExposure = THREE.MathUtils.damp(
      this.renderer.toneMappingExposure,
      this.target.exposure,
      speed,
      delta
    );

    this.ambient.intensity = THREE.MathUtils.damp(
      this.ambient.intensity, this.target.ambient, speed, delta
    );

    this.ceiling.intensity = THREE.MathUtils.damp(
      this.ceiling.intensity, this.target.ceiling, speed, delta
    );

    this.window.intensity = THREE.MathUtils.damp(
      this.window.intensity, this.target.window, speed, delta
    );

    this.fill.intensity = THREE.MathUtils.damp(
      this.fill.intensity, this.target.fill, speed, delta
    );

    this.front.intensity = THREE.MathUtils.damp(
      this.front.intensity, this.target.front, speed, delta
    );

    // мерцание свечи
    if (this.candleOn) {
      this.candleFlickerTime += delta;
      const flicker =
        Math.sin(this.candleFlickerTime * 8.7) * 0.10 +
        Math.sin(this.candleFlickerTime * 17.3) * 0.055 +
        Math.sin(this.candleFlickerTime * 3.1) * 0.035;
      this.candleLight.intensity = 16 + flicker * 2.0;
    }
  }

  public dispose(): void {
    this.camera.remove(this.candleLight);
    this.scene.remove(
      this.ambient,
      this.candleAmbient,
      this.ceiling,
      this.window,
      this.fill,
      this.front
    );
  }
}