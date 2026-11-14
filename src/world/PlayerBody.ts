import * as THREE from 'three';

// ноги от первого лица. По умолчанию выключены (visible = false),

export class PlayerBody {
  private readonly group = new THREE.Group();
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private walkTime = 0;
  private visible: boolean;

  constructor(private readonly camera: THREE.Camera, visible = false) {
    this.visible = visible;

    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: 0x354c70,
      roughness: 1,
      flatShading: true
    });

    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x85858a,
      roughness: 1,
      flatShading: true
    });

    const soleMaterial = new THREE.MeshStandardMaterial({
      color: 0x252525,
      roughness: 1,
      flatShading: true
    });

    const makeLeg = (x: number): THREE.Group => {
      const leg = new THREE.Group();
      leg.position.set(x, -0.12, -0.38);

      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.28), pantsMaterial);
      thigh.position.y = -0.18;
      leg.add(thigh);

      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.16, 0.25), pantsMaterial);
      knee.position.y = -0.48;
      leg.add(knee);

      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.38, 0.22), pantsMaterial);
      shin.position.y = -0.72;
      leg.add(shin);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.36), shoeMaterial);
      shoe.position.set(0, -0.98, -0.07);
      leg.add(shoe);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.05, 0.37), soleMaterial);
      sole.position.set(0, -1.075, -0.07);
      leg.add(sole);

      leg.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.frustumCulled = false;
          object.renderOrder = 2;
          object.castShadow = false;
          object.receiveShadow = false;
        }
      });

      return leg;
    };

    this.leftLeg = makeLeg(-0.17);
    this.rightLeg = makeLeg(0.17);
    this.group.add(this.leftLeg, this.rightLeg);
    this.group.frustumCulled = false;
    this.group.visible = this.visible;

    this.camera.add(this.group);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.group.visible = visible;
  }

  public update(delta: number, moving: boolean): void {
    if (!this.visible) return;

    if (moving) this.walkTime += delta * 8;

    const intensity = moving ? 0.35 : 0.015;
    const leftSwing = Math.sin(this.walkTime) * intensity;
    const rightSwing = Math.sin(this.walkTime + Math.PI) * intensity;

    this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, leftSwing, 10, delta);
    this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, rightSwing, 10, delta);
  }

  public destroy(): void {
    this.camera.remove(this.group);
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}