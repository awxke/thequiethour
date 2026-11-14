import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { log, warn, error } from '../core/debug';

// Анимированные персонажи окружения 
// Клоун спавнится отдельно в game.ts после сбора предметов.
export class Characters {
  public readonly group = new THREE.Group();
  public readonly collisionBoxes: THREE.Box3[] = [];
  private readonly loader = new GLTFLoader();
  private readonly mixers: THREE.AnimationMixer[] = [];

  public async load(): Promise<void> {
    // Загружаем крысу.
    await this.loadCharacter('rat', '/models/rat.glb', new THREE.Vector3(-11.12, 0.08, 5.84), true);
  }

  public update(delta: number): void {
    for (const mixer of this.mixers) mixer.update(delta);
  }

  public getObject(): THREE.Group {
    return this.group;
  }

  public destroy(): void {
    for (const mixer of this.mixers) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    this.mixers.length = 0;

    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(m => m.dispose());
      }
    });
    this.group.removeFromParent();
  }

  private async loadCharacter(
    name: string,
    path: string,
    position: THREE.Vector3,
    singleClip: boolean
  ): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const model = gltf.scene;
      model.name = name;

      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      });

      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());

      // масштаб не меняем — как в оригинале
      model.position.x += position.x - center.x;
      model.position.z += position.z - center.z;
      model.position.y += position.y - bounds.min.y;
      model.updateMatrixWorld(true);

      this.group.add(model);

      const finalBounds = new THREE.Box3().setFromObject(model);
      this.collisionBoxes.push(finalBounds);

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this.mixers.push(mixer);

        log(`Анимации ${name}:`, gltf.animations.map(c => c.name));

        if (singleClip) {
          // rat: один клип (idle/walk/run/animation), иначе первый
          const preferred = ['Idle', 'Walk', 'Run', 'Animation'];
          let clip: THREE.AnimationClip | undefined;

          for (const p of preferred) {
            clip = gltf.animations.find(c =>
              c.name.toLowerCase().includes(p.toLowerCase())
            );
            if (clip) break;
          }
          clip ??= gltf.animations[0];

          const action = mixer.clipAction(clip);
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();

          log(`Rat: запущен один клип "${clip.name}"`);
        } else {
          // Если когда-нибудь добавлю кого-то еще с кучей клипов
          gltf.animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
          });
          log(`${name}: запущено ${gltf.animations.length} клипов`);
        }
      } else {
        warn(`${name}.glb не содержит анимаций`);
      }

      log(`Модель ${name} загружена`);
    } catch (cause) {
      error(`Не удалось загрузить ${name} из ${path}`, cause);
    }
  }
}