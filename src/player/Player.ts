import * as THREE from 'three';

export interface PlayerInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  moveX: number; // стик, -1..1
  moveY: number;
}

// состояние игрока: позиция, скорость, ходьба, энергетик
export class Player {
  public readonly position = new THREE.Vector3(0, 1.08, 0);
  public readonly eyeHeight = 1.08;

  public walkTime = 0;
  public walkAmount = 0;

  public energyBoostTimer = 0;
  public readonly energyBoostDuration = 5;
  public readonly energyBoostMultiplier = 2.4;

  private readonly moveSpeed = 1.05;
  private readonly runMultiplier = 1.8;

  public getSpeed(input: PlayerInput): number {
    const sprint = input.sprint ? this.runMultiplier : 1;
    const boost = this.energyBoostTimer > 0 ? this.energyBoostMultiplier : 1;
    return this.moveSpeed * sprint * boost;
  }

  public updateTimers(delta: number): void {
    if (this.energyBoostTimer > 0) {
      this.energyBoostTimer = Math.max(0, this.energyBoostTimer - delta);
    }
  }

  public updateWalk(delta: number, moving: boolean): void {
    this.walkAmount = THREE.MathUtils.damp(this.walkAmount, moving ? 1 : 0, 7, delta);
    if (moving) this.walkTime += delta * 5.2;
  }

  public getCameraY(): number {
    return this.eyeHeight + Math.sin(this.walkTime * 2) * 0.012 * this.walkAmount;
  }
}