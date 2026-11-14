// FPS, координаты, хотбар. Иконки предметов — картинки моделей (через setItemIcon)
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private fpsFrames = 0;
  private fpsElapsed = 0;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly itemOrder: readonly string[],
    public selectedIndex: number
  ) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="game-debug">
        <div class="hud-fps">fps: 0</div>
        <div class="hud-coords">x: 0 y: 0 z: 0</div>
      </div>
      <div class="hotbar" aria-label="Инвентарь">
        ${itemOrder.map((item, i) => `
          <div class="hotbar-slot" data-slot="${i}">
            <span class="slot-number">${i + 1}</span>
            <span class="slot-icon" data-item="${item}"></span>
            <span class="slot-name">${item === 'energy' ? 'ENERGY' : item === 'light' ? 'CANDLE' : ''}</span>
          </div>
        `).join('')}
      </div>
    `;

    this.style = document.createElement('style');
    this.style.dataset.gameHudStyle = 'true';
    this.style.textContent = `
      .game-hud[hidden]{display:none!important}
      .game-hud{position:absolute;inset:0;z-index:12;pointer-events:none;color:#eee9d8;font:13px Arial,sans-serif;text-shadow:1px 2px 3px #000}
      .game-debug{position:absolute;right:18px;top:14px;text-align:right;line-height:1.55;font-weight:600;letter-spacing:.04em;background:rgba(0,0,0,.28);padding:7px 10px;border-radius:3px}
      .hotbar{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:7px}
      .hotbar-slot{width:66px;height:65px;box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(5,7,6,.58);border:1px solid rgba(220,215,190,.48);box-shadow:inset 0 0 12px rgba(0,0,0,.55)}
      .hotbar-slot.active{border:2px solid #eee4c5;background:rgba(100,86,54,.45);box-shadow:0 0 12px rgba(255,225,160,.25),inset 0 0 12px rgba(0,0,0,.5)}
      .slot-number{position:absolute;left:5px;top:3px;font-size:11px;color:#d5cfb8}
      .slot-icon{position:absolute;inset:6px 4px 14px 4px;display:flex;align-items:center;justify-content:center;pointer-events:none}
      .slot-icon img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
      .slot-name{position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8px;letter-spacing:.08em;color:#ddd6c2}
      @media(max-width:520px){.hotbar{gap:4px;bottom:12px}.hotbar-slot{width:54px;height:57px}.game-debug{right:8px;top:8px;font-size:11px}}
    `;

    this.container.appendChild(this.style);
    this.container.appendChild(this.root);
    this.updateHotbar();
  }

  public show(): void {
    this.root.hidden = false;
  }

  public setSelected(index: number): void {
    this.selectedIndex = index;
    this.updateHotbar();
  }

  // вставляем картинку модели в ячейку с data-item
  public setItemIcon(itemName: string, dataUrl: string): void {
    const slot = this.root.querySelector<HTMLElement>(`.slot-icon[data-item="${itemName}"]`);
    if (!slot) return;
    slot.innerHTML = `<img src="${dataUrl}" alt="${itemName}" />`;
  }

  public update(delta: number, position: { x: number; y: number; z: number }): void {
    if (this.root.hidden) return;

    this.fpsFrames++;
    this.fpsElapsed += delta;
    if (this.fpsElapsed < 0.35) return;

    const fps = Math.round(this.fpsFrames / this.fpsElapsed);
    this.fpsFrames = 0;
    this.fpsElapsed = 0;

    const fpsEl = this.root.querySelector<HTMLElement>('.hud-fps');
    const coordsEl = this.root.querySelector<HTMLElement>('.hud-coords');
    if (fpsEl) fpsEl.textContent = `fps: ${fps}`;
    if (coordsEl) {
      coordsEl.textContent =
        `x: ${position.x.toFixed(2)} y: ${position.y.toFixed(2)} z: ${position.z.toFixed(2)}`;
    }
  }

  public destroy(): void {
    this.root.remove();
    this.style.remove();
  }

  private updateHotbar(): void {
    this.root.querySelectorAll<HTMLElement>('.hotbar-slot').forEach((slot, i) => {
      slot.classList.toggle('active', i === this.selectedIndex);
    });
  }
}