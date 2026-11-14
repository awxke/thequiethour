import * as THREE from 'three';
import { Room } from '../world/Room';

// проверка столкновений через Room. 
export class CollisionController {
  private readonly radius = 0.3;

  constructor(private readonly room: Room) {}

  public tryMove(current: THREE.Vector3, movement: THREE.Vector3): THREE.Vector3 {
    const result = current.clone();

    const nextX = current.clone();
    nextX.x += movement.x;
    if (
      !this.room.isWallBlocked(current, nextX, this.radius) &&
      !this.room.isBlocked(nextX, this.radius)
    ) {
      result.x = nextX.x;
    }

    const nextZ = current.clone();
    nextZ.z += movement.z;
    if (
      !this.room.isWallBlocked(current, nextZ, this.radius) &&
      !this.room.isBlocked(nextZ, this.radius)
    ) {
      result.z = nextZ.z;
    }

    return result;
  }
}