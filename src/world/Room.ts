import * as THREE from 'three';
import { ModelLoader } from './ModelLoader';
import { Npc } from './Npc';
import { Mirror } from './Mirror';
import { Furniture } from './Furniture';
import { Characters } from './Characters';
import { log, error } from '../core/debug';

// комната: diner.glb + NPC + зеркало + мебель (опционально) + rat/clawn
export class Room {
  public readonly group = new THREE.Group();
  private readonly loader = new ModelLoader();

  private readonly roomMeshes: THREE.Mesh[] = [];
  private readonly wallRaycaster = new THREE.Raycaster();
  private readonly collisionBoxes: THREE.Box3[] = [];

  private npc: Npc | null = null;
  private mirror: Mirror | null = null;
  private furniture: Furniture | null = null;
  private characters: Characters | null = null;

  // мебель временно скрыта. Поставь true — вернётся
  private readonly loadFurniture = false;

  public async load(): Promise<void> {
    const room = await this.loader.load('/models/diner.glb');
    if (!room) {
      error('Room: diner.glb не загрузился');
      return;
    }

    room.name = 'diner';

    room.traverse(child => {
      if (child instanceof THREE.Mesh) this.roomMeshes.push(child);
    });

    room.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(room);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    log('Diner исходный размер:', size);

    const horizontal = Math.max(size.x, size.z);
    if (horizontal > 0) room.scale.setScalar(24 / horizontal);

    room.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(room);

    const center = new THREE.Vector3();
    bounds.getCenter(center);
    room.position.x -= center.x;
    room.position.z -= center.z;
    room.position.y -= bounds.min.y;
    room.updateMatrixWorld(true);

    this.group.add(room);

    const finalBounds = new THREE.Box3().setFromObject(room);
    log('Diner финальный размер:', finalBounds.getSize(new THREE.Vector3()));

    // NPC
    this.npc = new Npc();
    await this.npc.load();
    this.group.add(this.npc.getObject());
    if (this.npc.collisionBox) this.collisionBoxes.push(this.npc.collisionBox);

    // зеркало
    this.mirror = new Mirror();
    await this.mirror.load(finalBounds);
    this.group.add(this.mirror.getObject());

    // мебель (опционально)
    if (this.loadFurniture) {
      this.furniture = new Furniture();
      await this.furniture.load();
      this.group.add(this.furniture.getObject());
      this.collisionBoxes.push(...this.furniture.collisionBoxes);
    }

    // rat + clawn
    this.characters = new Characters();
    await this.characters.load();
    this.group.add(this.characters.getObject());
    this.collisionBoxes.push(...this.characters.collisionBoxes);
  }

  public isWallBlocked(
    current: THREE.Vector3,
    next: THREE.Vector3,
    radius = 0.3,
    playerHeight = 1.55
  ): boolean {
    if (this.roomMeshes.length === 0) return false;

    const movement = new THREE.Vector3(next.x - current.x, 0, next.z - current.z);
    const distance = movement.length();
    if (distance < 0.00001) return false;

    const direction = movement.clone().normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

    const verticalSamples = [0.2, playerHeight * 0.5, playerHeight - 0.2];
    const sideOffsets = [-radius * 0.75, 0, radius * 0.75];
    const feetY = current.y - 1.45;

    for (const sideOffset of sideOffsets) {
      for (const height of verticalSamples) {
        const origin = new THREE.Vector3(
          current.x + perpendicular.x * sideOffset,
          feetY + height,
          current.z + perpendicular.z * sideOffset
        );

        this.wallRaycaster.set(origin, direction);
        this.wallRaycaster.near = 0.01;
        this.wallRaycaster.far = distance + radius;

        const hits = this.wallRaycaster.intersectObjects(this.roomMeshes, false);
        if (hits.length > 0) return true;
      }
    }

    return false;
  }

  public isBlocked(
    position: THREE.Vector3,
    radius = 0.3,
    playerHeight = 1.55
  ): boolean {
    const feetY = position.y - 1.45;
    const headY = feetY + playerHeight;

    for (const box of this.collisionBoxes) {
      if (headY < box.min.y || feetY > box.max.y) continue;

      const closestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);

      const dx = position.x - closestX;
      const dz = position.z - closestZ;

      if (dx * dx + dz * dz < radius * radius) return true;
    }

    return false;
  }

  public update(delta: number): void {
    if (this.npc) this.npc.update(delta);
    if (this.characters) this.characters.update(delta);
  }

  public getObject(): THREE.Group {
    return this.group;
  }

  public destroy(): void {
    if (this.npc) { this.npc.destroy(); this.npc = null; }
    if (this.mirror) { this.mirror.destroy(); this.mirror = null; }
    if (this.furniture) { this.furniture.destroy(); this.furniture = null; }
    if (this.characters) { this.characters.destroy(); this.characters = null; }
  }
}