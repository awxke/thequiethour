import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { log, warn, error } from '../core/debug';

export interface InventoryCallbacks {
  onSelect: (index: number) => void;
  onUse: () => void;
  onCandleToggle: (on: boolean) => void;
}

// 3D-превью предмета + модель в руке (heldItem) + слоты.
// onCandleToggle(true) при выборе свечи, false — при выборе другого
export class Inventory {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  private readonly loader = new GLTFLoader();
  private readonly models: Partial<Record<'light' | 'energy', THREE.Object3D>> = {};
  private readonly clips: Partial<Record<'light' | 'energy', THREE.AnimationClip[]>> = {};
  private readonly displayMixers: THREE.AnimationMixer[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  private open = false;

  // модель в руке
  private readonly heldItemRoot = new THREE.Group();
  private heldItemMixer: THREE.AnimationMixer | null = null;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly playerCamera: THREE.Camera,
    private readonly itemOrder: readonly string[],
    public selectedIndex: number,
    private readonly callbacks: InventoryCallbacks
  ) {
    this.scene.background = new THREE.Color(0x11130f);
    this.camera.aspect = 900 / 520;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0.05, 4.2);
    this.camera.lookAt(0, 0.05, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.65));
    const key = new THREE.DirectionalLight(0xffe9c5, 2.1);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8795a0, 0.8);
    rim.position.set(2, 1, -3);
    this.scene.add(rim);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'inventory-preview-canvas';

    this.root = document.createElement('div');
    this.root.className = 'inventory-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="inventory-screen">
        <div class="inventory-top-line">
          <span class="inventory-dash">-</span>
          <div class="inventory-heading">INVENTORY</div>
          <span class="inventory-dash">-</span>
        </div>
        <button class="inventory-arrow inventory-arrow-left" type="button" aria-label="Предыдущий">◀</button>
        <button class="inventory-arrow inventory-arrow-right" type="button" aria-label="Следующий">▶</button>
        <div class="inventory-preview"></div>
        <section class="inventory-item-info">
          <div class="inventory-item-name">EMPTY HANDS</div>
          <div class="inventory-item-description">Your hands are empty.</div>
        </section>
        <div class="inventory-bottom-help">
          <span><b>SELECT:</b> 1 - 5</span><i></i>
          <span><b>USE:</b> E</span><i></i>
          <span><b>CLOSE:</b> I</span>
        </div>
        <div class="inventory-close-help">I / ESC — CLOSE</div>
      </div>
    `;

    this.style = document.createElement('style');
    this.style.dataset.inventoryStyle = 'true';
    this.style.textContent = `
      .inventory-overlay {
        position:absolute; inset:0; z-index:50; overflow:hidden;
        display:flex; align-items:center; justify-content:center;
        color:#e7e4d8; background:rgba(3,5,5,.82);
        font-family:Georgia,'Times New Roman',serif;
        text-shadow:2px 2px 0 #080a0a, 0 0 5px rgba(210,220,210,.2);
        user-select:none;
      }
      .inventory-overlay[hidden] { display:none !important; }
      .inventory-screen {
        position:relative; width:100%; height:100%; min-height:420px;
        background:linear-gradient(180deg,rgba(23,29,27,.94) 0%,rgba(8,12,12,.72) 27%,rgba(5,8,9,.62) 72%,rgba(13,17,16,.96) 100%),
          radial-gradient(ellipse at 50% 54%,rgba(91,105,91,.22),transparent 62%);
        border-top:1px solid rgba(200,205,190,.13);
        border-bottom:1px solid rgba(200,205,190,.13); box-sizing:border-box;
      }
      .inventory-top-line {
        position:absolute; z-index:3; top:0; left:50%; transform:translateX(-50%);
        display:flex; align-items:center; justify-content:center; gap:22px;
        height:62px; white-space:nowrap;
      }
      .inventory-heading { font-size:clamp(24px,3.3vw,46px); letter-spacing:.12em; line-height:1; }
      .inventory-dash { font-size:clamp(20px,2.5vw,34px); color:#aeb4a8; }
      .inventory-preview {
        position:absolute; left:25%; right:24%; top:14%; bottom:19%;
        background:radial-gradient(ellipse at 50% 53%,rgba(155,164,139,.15),transparent 64%);
      }
      .inventory-preview-canvas { display:block; width:100%; height:100%; image-rendering:pixelated; }
      .inventory-arrow {
        position:absolute; z-index:4; top:8%; width:54px; height:54px;
        border:0; background:transparent; color:#e8e6dc; cursor:pointer;
        font:bold clamp(30px,4vw,48px) Georgia,serif;
        text-shadow:3px 3px 0 #111; filter:drop-shadow(0 0 2px rgba(255,255,255,.3));
      }
      .inventory-arrow:hover { color:#fff; transform:scale(1.12); }
      .inventory-arrow-left { left:17%; } .inventory-arrow-right { right:17%; }
      .inventory-item-info {
        position:absolute; left:0; top:27%; width:29%; box-sizing:border-box;
        padding:0 18px 0 0; text-align:left; overflow:hidden;
      }
      .inventory-item-name { font-size:clamp(20px,2.6vw,38px); line-height:1.1; overflow-wrap:anywhere; color:#f0eee5; }
      .inventory-item-description {
        margin-top:14px; max-width:310px; font-size:clamp(14px,1.7vw,23px);
        line-height:1.25; color:#d0d0c8; white-space:pre-line;
      }
      .inventory-bottom-help {
        position:absolute; left:0; right:0; bottom:4.2%; display:flex;
        justify-content:center; align-items:center; gap:clamp(10px,2vw,28px);
        white-space:nowrap; font:clamp(12px,1.8vw,25px) Arial,sans-serif;
        letter-spacing:.025em; color:#eeeade; text-shadow:2px 2px #090909;
      }
      .inventory-bottom-help b { font-weight:700; }
      .inventory-bottom-help i { height:1.1em; width:2px; background:rgba(225,225,215,.75); }
      .inventory-close-help {
        position:absolute; right:2%; bottom:1.2%; color:rgba(220,220,205,.48);
        font:9px Arial,sans-serif; letter-spacing:.12em;
      }
      @media(max-width:650px) {
        .inventory-preview { left:15%; right:15%; top:22%; bottom:24%; }
        .inventory-item-info { top:15%; width:34%; }
        .inventory-arrow-left { left:4%; } .inventory-arrow-right { right:4%; }
        .inventory-bottom-help { bottom:5%; gap:8px; font-size:10px; }
        .inventory-item-description { font-size:12px; }
      }
    `;

    const preview = this.root.querySelector<HTMLElement>('.inventory-preview');
    if (preview) preview.appendChild(this.canvas);

    this.root.querySelector('.inventory-arrow-left')?.addEventListener('click', () => this.cycle(-1));
    this.root.querySelector('.inventory-arrow-right')?.addEventListener('click', () => this.cycle(1));

    this.container.appendChild(this.style);
    this.container.appendChild(this.root);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power'
      });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(900, 520, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
    } catch (cause) {
      error('Не удалось создать окно 3D-инвентаря', cause);
    }

    // модель в руке: правый нижний угол кадра
    this.heldItemRoot.position.set(0.39, -0.34, -0.72);
    this.heldItemRoot.rotation.set(0.06, -0.16, -0.08);
    this.playerCamera.add(this.heldItemRoot);

    void this.loadModel('light', '/models/light.glb');
    void this.loadModel('energy', '/models/energy.glb');
    this.updateLabels();
  }

  public toggle(): void {
    this.open = !this.open;
    this.root.hidden = !this.open;
    if (this.open) this.refreshScene();
  }

  public isOpen(): boolean {
    return this.open;
  }

  public select(index: number): void {
    if (index < 0 || index >= this.itemOrder.length) return;
    this.selectedIndex = index;
    this.refreshScene();
    this.refreshHeldItem();
    this.callbacks.onSelect(index);
    this.callbacks.onCandleToggle(this.itemOrder[index] === 'light');
  }

  public cycle(direction: -1 | 1): void {
    const next = (this.selectedIndex + direction + this.itemOrder.length) % this.itemOrder.length;
    this.select(next);
  }

  public update(delta: number): void {
    if (this.heldItemMixer) this.heldItemMixer.update(delta);

    if (!this.open) return;
    for (const mixer of this.displayMixers) mixer.update(delta);
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.stopDisplayMixers();

    if (this.heldItemMixer) {
      this.heldItemMixer.stopAllAction();
      this.heldItemMixer.uncacheRoot(this.heldItemMixer.getRoot());
      this.heldItemMixer = null;
    }
    this.playerCamera.remove(this.heldItemRoot);

    this.root.remove();
    this.style.remove();
  }

  private refreshHeldItem(): void {
    this.heldItemRoot.clear();
    if (this.heldItemMixer) {
      this.heldItemMixer.stopAllAction();
      this.heldItemMixer.uncacheRoot(this.heldItemMixer.getRoot());
      this.heldItemMixer = null;
    }

    const selected = this.itemOrder[this.selectedIndex];
    const source = this.getModel(selected);
    if (!source) return;

    const held = cloneSkeleton(source);
    held.position.set(0, 0, 0);
    held.rotation.set(0.12, -0.08, 0.04);
    held.scale.multiplyScalar(selected === 'energy' ? 1.75 : 1.35);
    this.heldItemRoot.add(held);

    const clips = this.clips[selected as 'light' | 'energy'] ?? [];
    if (clips.length > 0) {
      this.heldItemMixer = new THREE.AnimationMixer(held);
      const clip = THREE.AnimationClip.findByName(clips, 'idle') ?? clips[0];
      this.heldItemMixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }

  private async loadModel(name: 'light' | 'energy', path: string): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const model = gltf.scene;

      let embeddedEnergyTexture: THREE.Texture | null = null;
      if (name === 'energy') {
        try {
          embeddedEnergyTexture = await gltf.parser.getDependency('texture', 0) as THREE.Texture;
          embeddedEnergyTexture.colorSpace = THREE.SRGBColorSpace;
          embeddedEnergyTexture.needsUpdate = true;
        } catch (cause) {
          warn('Не удалось получить встроенную текстуру White Monster', cause);
        }
      }

      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          const mat = material as THREE.MeshStandardMaterial & {
            map?: THREE.Texture | null;
            emissiveMap?: THREE.Texture | null;
          };
          if (!mat.map && name === 'energy' && embeddedEnergyTexture) {
            mat.map = embeddedEnergyTexture;
          }
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          if (mat.emissiveMap) {
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            mat.emissiveMap.needsUpdate = true;
          }
          if (name === 'energy' && material instanceof THREE.MeshStandardMaterial) {
            material.color.set(0xffffff);
            material.roughness = 0.62;
            material.metalness = 0.02;
          }
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            material.needsUpdate = true;
          }
        });
      });

      model.updateMatrixWorld(true);
      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      const sourceHeight = sourceSize.y > 0 ? sourceSize.y : Math.max(sourceSize.x, sourceSize.z);
      const targetHeight = name === 'energy' ? 0.17 : 0.22;
      if (sourceHeight > 0) model.scale.setScalar(targetHeight / sourceHeight);

      model.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      const center = scaledBounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBounds.min.y;

      this.models[name] = model;
      this.clips[name] = gltf.animations ?? [];
      log(`Предмет ${name} загружен.`, this.clips[name]?.map(c => c.name) ?? []);

      this.refreshScene();
      this.refreshHeldItem();
    } catch (cause) {
      error(`Не удалось загрузить предмет ${path}`, cause);
    }
  }

  private getModel(name: string): THREE.Object3D | null {
    if (name === 'light' || name === 'energy') return this.models[name] ?? null;
    return null;
  }

  private stopDisplayMixers(): void {
    for (const mixer of this.displayMixers) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    this.displayMixers.length = 0;
    for (const child of [...this.scene.children]) {
      if (child.userData.inventoryDisplay) this.scene.remove(child);
    }
  }

  private addDisplay(item: string, position: THREE.Vector3, scale: number, opacity = 1): void {
    const source = this.getModel(item);
    if (!source) return;

    const display = cloneSkeleton(source);
    display.userData.inventoryDisplay = true;
    display.position.copy(position);
    display.scale.multiplyScalar(scale);

    if (opacity < 1) {
      display.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
        child.material = sourceMaterials.map(material => {
          const clone = material.clone();
          const tm = clone as THREE.Material & { transparent?: boolean; opacity?: number; depthWrite?: boolean };
          tm.transparent = true;
          tm.opacity = opacity;
          tm.depthWrite = false;
          return clone;
        });
      });
    }

    this.scene.add(display);
    const clips = this.clips[item as 'light' | 'energy'] ?? [];
    if (clips.length > 0) {
      const mixer = new THREE.AnimationMixer(display);
      const clip = THREE.AnimationClip.findByName(clips, 'idle') ?? clips[0];
      mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
      this.displayMixers.push(mixer);
    }
  }

  private refreshScene(): void {
    this.stopDisplayMixers();
    const selected = this.itemOrder[this.selectedIndex];
    const next = this.itemOrder[(this.selectedIndex + 1) % this.itemOrder.length];
    this.addDisplay(selected, new THREE.Vector3(-0.12, 0, 0.1), 4.3);
    this.addDisplay(next, new THREE.Vector3(1.05, -0.04, -0.55), 2.35, 0.62);
    this.updateLabels();
  }

  private getLabel(item: string): string {
    if (item === 'light') return 'CANDLE';
    if (item === 'energy') return 'ENERGY DRINK';
    return 'EMPTY HANDS';
  }

  private updateLabels(): void {
    const selected = this.itemOrder[this.selectedIndex];
    const name = this.root.querySelector<HTMLElement>('.inventory-item-name');
    const description = this.root.querySelector<HTMLElement>('.inventory-item-description');
    if (name) name.textContent = this.getLabel(selected);
    if (description) {
      if (selected === 'light') description.textContent = 'A small candle.\nIts flame gives off a little light.';
      else if (selected === 'energy') description.textContent = 'White Monster Energy.\nA can that gives you a burst of energy.';
      else description.textContent = 'Your hands are empty.';
    }
  }
}