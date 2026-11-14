import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { log, error } from '../core/debug';

// общий загрузчик GLTF: тени, colorSpace, roughness. Один на всю игру
export class ModelLoader {
  private readonly loader = new GLTFLoader();

  public async load(path: string): Promise<THREE.Group | null> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const model = gltf.scene;

      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          material.side = THREE.DoubleSide;
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = Math.max(material.roughness, 0.65);
            material.needsUpdate = true;
          }
        });
      });

      log(`GLTF загружен: ${path}`);
      return model;
    } catch (cause) {
      error(`Не удалось загрузить ${path}`, cause);
      return null;
    }
  }
}