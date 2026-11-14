import * as THREE from 'three';

// проверяет, подошёл ли игрок к NPC, и запускает диалог один раз
export class DialogTrigger {
  private triggered = false;

  constructor(
    private readonly npcPosition: THREE.Vector3,
    private readonly radius = 2.0,
    private readonly onTrigger: () => void
  ) {}

  public update(playerPosition: THREE.Vector3): void {
    if (this.triggered) return;

    const dx = playerPosition.x - this.npcPosition.x;
    const dz = playerPosition.z - this.npcPosition.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < this.radius * this.radius) {
      this.triggered = true;
      this.onTrigger();
    }
  }

  public reset(): void {
    this.triggered = false;
  }
}