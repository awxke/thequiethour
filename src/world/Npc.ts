import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { log, warn, error } from '../core/debug';

// NPC yrod: модель + анимация. Коллизия-коробка возвращается наружу
export class Npc {
  public readonly group = new THREE.Group();
  public collisionBox: THREE.Box3 | null = null;

  private readonly loader = new GLTFLoader();
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;

  private readonly position = new THREE.Vector3(0, 0, 1.5);
  private readonly rotationY = Math.PI;
  private readonly targetHeight = 1.8;

  public async load(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/models/yrod.glb');
      const model = gltf.scene;
      model.name = 'yrod';

      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      });

      model.updateMatrixWorld(true);

      // масштаб по высоте
      let bounds = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      if (size.y > 0) model.scale.setScalar(this.targetHeight / size.y);

      model.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(model);

      // центрируем по X/Z, ставим на пол
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      model.position.x += this.position.x - center.x;
      model.position.z += this.position.z - center.z;
      model.position.y += this.position.y - bounds.min.y;
      model.rotation.y = this.rotationY;

      model.updateMatrixWorld(true);

      this.group.add(model);
      this.collisionBox = new THREE.Box3().setFromObject(model);

      // анимация: ищем wave/idle/talk, иначе первый клип
      if (gltf.animations && gltf.animations.length > 0) {
        log('Анимации yrod:', gltf.animations.map(c => c.name));
        this.mixer = new THREE.AnimationMixer(model);

        const preferred = ['Wave', 'Waving', 'Gesture', 'Greet', 'Hello', 'Hand', 'Arm', 'Point', 'Talk', 'Idle'];
        let clip: THREE.AnimationClip | null = null;

        for (const name of preferred) {
          clip = THREE.AnimationClip.findByName(gltf.animations, name);
          if (clip) break;
        }
        if (!clip) {
          clip = gltf.animations.find(c =>
            preferred.some(p => c.name.toLowerCase().includes(p.toLowerCase()))
          ) ?? null;
        }
        clip ??= gltf.animations[0];

        this.action = this.mixer.clipAction(clip);
        this.action.setLoop(THREE.LoopRepeat, Infinity);
        this.action.play();
        log('Анимация NPC запущена:', clip.name);
      } else {
        warn('yrod.glb не содержит анимаций');
      }

      log('NPC yrod загружен');
    } catch (cause) {
      error('Не удалось загрузить yrod.glb', cause);
    }
  }

  public update(delta: number): void {
    if (this.mixer) this.mixer.update(delta);
  }

  public getObject(): THREE.Group {
    return this.group;
  }

  public destroy(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
      this.action = null;
    }
    this.group.removeFromParent();
  }
}