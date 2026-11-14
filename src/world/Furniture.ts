import * as THREE from 'three';
import { ModelLoader } from './ModelLoader';
import { log, error } from '../core/debug';

interface FurnitureItem {
  name: string;
  path: string;
  targetSize: number;
  position: THREE.Vector3;
  rotationY: number;
  rotationX?: number;
  useHeight?: boolean;
  addCollision?: boolean;
}

// вся мебель комнаты: кровать, PS1, диски, гитары, crash.
// Позиции и масштабы — как в оригинальном modelSettings
export class Furniture {
  public readonly group = new THREE.Group();
  public readonly collisionBoxes: THREE.Box3[] = [];
  private readonly loader = new ModelLoader();

  private readonly items: FurnitureItem[] = [
    {
      name: 'bed',
      path: '/models/bed.glb',
      targetSize: 2.0,
      position: new THREE.Vector3(-3.5, 0, 0.8),
      rotationY: Math.PI / 2,
      addCollision: true
    },
    {
      name: 'ps1',
      path: '/models/ps1.glb',
      targetSize: 1.5,
      position: new THREE.Vector3(2.0, 0.1, -1.0),
      rotationY: -Math.PI / 2
    },
    {
      name: 'disk',
      path: '/models/disk.glb',
      targetSize: 0.4,
      position: new THREE.Vector3(0.8, 0.015, -1.0),
      rotationY: 0,
      rotationX: -Math.PI / 2
    },
    {
      name: 'crash',
      path: '/models/crash.glb',
      targetSize: 0.8,
      position: new THREE.Vector3(0, 0, -2.5),
      rotationY: Math.PI,
      useHeight: true
    },
    {
      name: 'bass',
      path: '/models/bass.glb',
      targetSize: 1.4,
      position: new THREE.Vector3(-1.8, 0, -3.8),
      rotationY: 0,
      addCollision: true
    },
    {
      name: 'fender',
      path: '/models/fender.glb',
      targetSize: 1.4,
      position: new THREE.Vector3(0, 0, -3.8),
      rotationY: 0,
      addCollision: true
    },
    {
      name: 'classic',
      path: '/models/classic.glb',
      targetSize: 1.4,
      position: new THREE.Vector3(1.8, 0, -3.8),
      rotationY: 0,
      addCollision: true
    }
  ];

  public async load(): Promise<void> {
    await Promise.all(this.items.map(item => this.loadItem(item)));
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

  private async loadItem(item: FurnitureItem): Promise<void> {
    const model = await this.loader.load(item.path);
    if (!model) {
      error(`Furniture: ${item.name} не загрузился`);
      return;
    }

    model.name = item.name;
    model.rotation.set(item.rotationX ?? 0, item.rotationY, 0);

    model.updateMatrixWorld(true);

    // масштаб: по высоте (useHeight) или по максимальной стороне
    let bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const dimension = item.useHeight ? size.y : Math.max(size.x, size.y, size.z);

    if (dimension > 0) {
      model.scale.setScalar(item.targetSize / dimension);
    }

    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);

    // центрируем по X/Z, ставим на пол
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    model.position.x += item.position.x - center.x;
    model.position.z += item.position.z - center.z;
    model.position.y += item.position.y - bounds.min.y;

    model.updateMatrixWorld(true);

    this.group.add(model);

    if (item.addCollision) {
      const box = new THREE.Box3().setFromObject(model);
      this.collisionBoxes.push(box);
    }

    log(`Мебель ${item.name} загружена`);
  }
}