import * as THREE from 'three';

// yaw/pitch, мышь, стик, FOV, покачивание. 
export class CameraController {
  public yaw = 0;
  public pitch = 0;

  public targetFov = 75;
  private readonly minFov = 5;
  private readonly maxFov = 100;
  private readonly mouseSensitivity = 0.002;
  private readonly gamepadSensitivity = 1.8;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.camera.rotation.order = 'YXZ';
  }

  public onMouseMove(dx: number, dy: number): void {
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;
    this.clampPitch();
  }

  public onGamepadLook(x: number, y: number, delta: number): void {
    if (x === 0 && y === 0) return;
    this.yaw -= x * this.gamepadSensitivity * delta;
    this.pitch -= y * this.gamepadSensitivity * delta;
    this.clampPitch();
  }

  public onWheel(deltaY: number): void {
    this.targetFov *= Math.exp(deltaY * 0.0015);
    this.targetFov = THREE.MathUtils.clamp(this.targetFov, this.minFov, this.maxFov);
  }

  public update(delta: number): void {
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.targetFov, 12, delta);
    this.camera.updateProjectionMatrix();
  }

  private clampPitch(): void {
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.5, Math.PI / 2.5);
  }
}