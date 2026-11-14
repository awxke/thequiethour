import type { BrightnessMode } from '../types';
import type { Sfx } from '../audio/Sfx';

export interface MainMenuCallbacks {
  onStart: () => void;
  onBrightnessChange: (mode: BrightnessMode) => void;
}

export interface MenuGamepadState {
  moveY: number;
  crossPressed: boolean;
  startPressed: boolean;
}

// DOM-меню: START / SETTINGS / EXIT + яркость.
// Клавиатура (стрелки + Enter), геймпад (левый стик + крест/Start).
// Звуки: move / select / cancel
export class MainMenu {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private screen: 'main' | 'settings' = 'main';
  private selection = 0;
  private brightnessLabel: 'HIGH' | 'NORMAL' | 'LOW' = 'HIGH';

  private prevPadY = 0;
  private prevPadConfirm = false;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly sfx: Sfx,
    private readonly callbacks: MainMenuCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'ps1-menu';
    this.root.innerHTML = `
      <div class="ps1-vignette"></div>
      <div class="ps1-menu-content">
        <div class="ps1-title">The Quiet Hour</div>
        <div class="ps1-subtitle">AN UNKNOWN PLACE</div>
        <div class="ps1-menu-items">
          <button class="ps1-menu-item selected" data-action="start">
            <span class="ps1-pointer">▶</span><span>START GAME</span>
          </button>
          <button class="ps1-menu-item" data-action="settings">
            <span class="ps1-pointer"></span><span>SETTINGS</span>
          </button>
          <button class="ps1-menu-item" data-action="exit">
            <span class="ps1-pointer"></span><span>EXIT</span>
          </button>
        </div>
        <div class="ps1-settings" hidden>
          <div class="ps1-settings-title">SETTINGS</div>
          <button class="ps1-menu-item" data-action="brightness">
            BRIGHTNESS: <span class="ps1-brightness-value">HIGH</span>
          </button>
          <button class="ps1-menu-item" data-action="back">
            <span class="ps1-pointer">▶</span><span>BACK</span>
          </button>
        </div>
        <div class="ps1-footer">PRESS ENTER TO SELECT</div>
      </div>
      <div class="ps1-exit-message" hidden>YOU CAN CLOSE THIS TAB TO EXIT</div>
    `;

    this.style = document.createElement('style');
    this.style.dataset.ps1MenuStyle = 'true';
    this.style.textContent = `
      .ps1-menu {
        position:absolute; inset:0; z-index:20; overflow:hidden;
        color:#e8e3ca; background:transparent;
        font-family:Georgia, 'Times New Roman', serif;
        text-shadow:1px 1px 0 #29251d, 0 0 7px rgba(235,229,190,.45);
        pointer-events:auto;
      }
      .ps1-menu [hidden] { display:none !important; }
      .ps1-menu-content {
        position:absolute; left:6.5%; top:49%; transform:translateY(-50%);
        width:min(43vw, 620px); min-width:300px; z-index:2;
      }
      .ps1-title {
        position:relative; display:inline-block;
        font-size:clamp(34px,5.3vw,76px); line-height:.92;
        letter-spacing:-.065em; white-space:nowrap; font-weight:500;
        color:#e8e1c9; transform:scaleX(.82); transform-origin:left center;
        text-shadow:2px 2px 0 #393629, -1px 0 rgba(255,255,255,.5);
      }
      .ps1-subtitle {
        margin:18px 0 28px 4px; font:clamp(8px,1vw,12px) Arial,sans-serif;
        letter-spacing:.25em; color:#c8c0a7; opacity:.62;
      }
      .ps1-menu-items,.ps1-settings { display:flex; flex-direction:column; gap:7px; }
      .ps1-menu-item {
        display:flex; align-items:center; gap:13px; width:max-content;
        min-width:210px; padding:2px 10px 2px 0; border:0; background:transparent;
        color:#ddd8c6; text-align:left; cursor:pointer;
        font:clamp(16px,1.8vw,24px) Georgia,'Times New Roman',serif;
        letter-spacing:.015em; text-shadow:inherit;
      }
      .ps1-menu-item:hover,.ps1-menu-item.selected { color:#fff5d5; }
      .ps1-pointer { display:inline-block; width:17px; color:#eee4c7; opacity:0; }
      .ps1-menu-item.selected .ps1-pointer { opacity:1; animation:ps1blink .9s steps(2,end) infinite; }
      .ps1-footer {
        margin:34px 0 0 4px; font:9px Arial,sans-serif;
        letter-spacing:.2em; opacity:.42;
      }
      .ps1-settings-title { font-size:15px; margin-bottom:17px; }
      .ps1-exit-message {
        position:absolute; left:50%; bottom:9%; transform:translateX(-50%);
        font:12px Arial,sans-serif; letter-spacing:.15em;
      }
      .ps1-vignette {
        position:absolute; inset:0; pointer-events:none; z-index:3;
        box-shadow:inset 0 0 11vw 2.8vw rgba(0,0,0,.72);
      }
      @keyframes ps1blink { 50% { opacity:0; } }
      @media(max-width:650px) {
        .ps1-menu-content { left:5%; top:52%; width:90%; }
        .ps1-title { font-size:clamp(30px,9vw,54px); }
      }
    `;

    this.container.style.position = 'relative';
    this.container.appendChild(this.style);
    this.container.appendChild(this.root);

    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        this.handleAction(button.dataset.action || '');
      });
    });

    window.addEventListener('keydown', this.handleKeyDown);
    this.updateSelection();
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
    this.style.remove();
  }

  public handleGamepad(state: MenuGamepadState): void {
    const y = state.moveY;
    const down = y > 0.5 && this.prevPadY <= 0.5;
    const up = y < -0.5 && this.prevPadY >= -0.5;

    if (down || up) {
      const items = this.getItems();
      if (items.length > 0) {
        this.sfx.playMove();
        const step = down ? 1 : -1;
        this.selection = (this.selection + step + items.length) % items.length;
        this.updateSelection();
      }
    }
    this.prevPadY = y;

    const confirm = state.crossPressed || state.startPressed;
    if (confirm && !this.prevPadConfirm) {
      const items = this.getItems();
      if (items[this.selection]) items[this.selection].click();
    }
    this.prevPadConfirm = confirm;
  }

  private getItems(): HTMLButtonElement[] {
    const selector = this.screen === 'main'
      ? '.ps1-menu-items .ps1-menu-item'
      : '.ps1-settings .ps1-menu-item';
    return Array.from(this.root.querySelectorAll<HTMLButtonElement>(selector));
  }

  private handleAction(action: string): void {
    if (action === 'start') {
      this.sfx.playSelect();
      this.callbacks.onStart();
      return;
    }

    if (action === 'back' || action === 'exit') {
      this.sfx.playCancel();
    } else {
      this.sfx.playSelect();
    }

    const main = this.root.querySelector<HTMLElement>('.ps1-menu-items');
    const settings = this.root.querySelector<HTMLElement>('.ps1-settings');
    const footer = this.root.querySelector<HTMLElement>('.ps1-footer');

    if (action === 'settings') {
      if (main) main.hidden = true;
      if (settings) settings.hidden = false;
      this.screen = 'settings';
      this.selection = 0;
      if (footer) footer.textContent = 'VIDEO AND AUDIO';
      this.updateSelection();
    } else if (action === 'back') {
      if (main) main.hidden = false;
      if (settings) settings.hidden = true;
      this.screen = 'main';
      this.selection = 0;
      if (footer) footer.textContent = 'PRESS ENTER TO SELECT';
      this.updateSelection();
    } else if (action === 'brightness') {
      const value = this.root.querySelector<HTMLElement>('.ps1-brightness-value');
      this.brightnessLabel =
        this.brightnessLabel === 'HIGH' ? 'NORMAL' :
        this.brightnessLabel === 'NORMAL' ? 'LOW' : 'HIGH';
      if (value) value.textContent = this.brightnessLabel;

      const mode: BrightnessMode =
        this.brightnessLabel === 'HIGH' ? 'veryBright' :
        this.brightnessLabel === 'NORMAL' ? 'bright' : 'normal';
      this.callbacks.onBrightnessChange(mode);
    } else if (action === 'exit') {
      const message = this.root.querySelector<HTMLElement>('.ps1-exit-message');
      if (message) message.hidden = false;
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const items = this.getItems();

    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      this.sfx.playMove();
      const step = e.code === 'ArrowDown' ? 1 : -1;
      this.selection = (this.selection + step + items.length) % items.length;
      this.updateSelection();
      e.preventDefault();
    } else if (e.code === 'Enter' && items[this.selection]) {
      items[this.selection].click();
      e.preventDefault();
    }
  };

  private updateSelection(): void {
    const items = this.getItems();
    items.forEach((item, index) => {
      const selected = index === this.selection;
      item.classList.toggle('selected', selected);
      const pointer = item.querySelector('.ps1-pointer');
      if (pointer) pointer.textContent = selected ? '▶' : '';
    });
  }
}