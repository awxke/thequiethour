import * as THREE from 'three';

export class DialogPrompt {
  public readonly sprite: THREE.Sprite;
  private texture: THREE.CanvasTexture;
  private currentDevice: 'keyboard' | 'gamepad' = 'keyboard';
  private visible = false;
  private readonly baseY: number;

  constructor(
    private readonly npcPosition: THREE.Vector3,
    height = 0.5
  ) {
    this.baseY = npcPosition.y + height;
    this.texture = this.createTexture('keyboard');

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    this.sprite = new THREE.Sprite(material);
    this.sprite.position.set(npcPosition.x + -0.7 , this.baseY, npcPosition.z);
    
    //РАЗМЕР
    this.sprite.scale.set(0.7, 0.25, 1); 
    
    this.sprite.visible = false;
    this.sprite.renderOrder = 999;
  }

  public setDevice(device: 'keyboard' | 'gamepad'): void {
    if (this.currentDevice === device) return;
    this.currentDevice = device;
    this.texture.dispose();
    this.texture = this.createTexture(device);
    const material = this.sprite.material as THREE.SpriteMaterial;
    material.map = this.texture;
    material.needsUpdate = true;
  }

  public update(playerPosition: THREE.Vector3, radius: number, blocked: boolean): void {
    const dx = playerPosition.x - this.npcPosition.x;
    const dz = playerPosition.z - this.npcPosition.z;
    const distSq = dx * dx + dz * dz;
    const near = distSq < radius * radius;

    const shouldShow = near && !blocked;
    if (shouldShow !== this.visible) {
      this.visible = shouldShow;
      this.sprite.visible = shouldShow;
    }
  }

  public destroy(): void {
    this.texture.dispose();
    this.sprite.removeFromParent();
  }

  private createTexture(device: 'keyboard' | 'gamepad'): THREE.CanvasTexture {
    const width = 256;
    const height = 96;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e8e1c9';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px "Courier New", monospace';

    const text = device === 'gamepad' ? 'PRESS ✕' : 'PRESS E';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    return texture;
  }
}