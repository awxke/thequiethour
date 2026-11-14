import * as THREE from 'three';

// сцена, фон и туман. Всё, что видно «за» объектами
export class Scene {
  public readonly three: THREE.Scene;

  constructor() {
    this.three = new THREE.Scene();
    this.three.background = new THREE.Color(0x35435e);
    this.three.fog = new THREE.Fog(0x35435e, 35, 65);
  }

  public add(object: THREE.Object3D): void {
    this.three.add(object);
  }

  public remove(object: THREE.Object3D): void {
    this.three.remove(object);
  }
}