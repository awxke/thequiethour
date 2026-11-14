import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { log, error } from '../core/debug';

// зеркало: рамка (glb) + реальное отражение (Reflector). Ставится на заднюю стену
export class Mirror {
  public readonly group = new THREE.Group();
  private readonly loader = new GLTFLoader();

  public async load(roomBounds: THREE.Box3): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/models/wall_mirror_mirror_espejo_de_pared.glb');
      const frame = gltf.scene;
      frame.name = 'wall-mirror-frame';

      frame.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      });

      frame.updateMatrixWorld(true);

      const originalBounds = new THREE.Box3().setFromObject(frame);
      const originalSize = originalBounds.getSize(new THREE.Vector3());
      const scale = 2.15 / Math.max(originalSize.x, originalSize.y, originalSize.z);

      frame.scale.setScalar(scale);
      frame.updateMatrixWorld(true);

      const scaledBounds = new THREE.Box3().setFromObject(frame);
      const center = scaledBounds.getCenter(new THREE.Vector3());

      const wallZ = roomBounds.min.z + 0.10;
      const mirrorX = roomBounds.min.x + Math.min(3.2, roomBounds.getSize(new THREE.Vector3()).x * 0.22);
      const mirrorY = Math.min(1.65, roomBounds.max.y - 0.8);

      frame.position.set(mirrorX - center.x, mirrorY - center.y, wallZ - center.z);
      this.group.add(frame);

      const reflector = new Reflector(
        new THREE.PlaneGeometry(1.82, 0.88),
        {
          clipBias: 0.003,
          textureWidth: 1024,
          textureHeight: 512,
          color: 0xd0d6e2
        }
      );
      reflector.name = 'wall-mirror-reflection';
      reflector.position.set(mirrorX, mirrorY, wallZ + 0.035);
      reflector.renderOrder = 2;
      this.group.add(reflector);

      log('Зеркало установлено:', { x: mirrorX, y: mirrorY, z: wallZ });
    } catch (cause) {
      error('Не удалось загрузить зеркало', cause);
    }
  }

  public getObject(): THREE.Group {
    return this.group;
  }

  public destroy(): void {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(m => m.dispose());
      }
    });
    this.group.removeFromParent();
  }
}