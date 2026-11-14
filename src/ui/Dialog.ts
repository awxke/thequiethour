export type InputDevice = 'keyboard' | 'gamepad';

export interface DialogPage {
  text: string;
}

export interface DialogCallbacks {
  onClose: () => void;
}

export class Dialog {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private pages: DialogPage[] = [];
  private pageIndex = 0;
  private open = false;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly device: InputDevice,
    private readonly callbacks: DialogCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'dialog-root';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-speaker">YROD</div>
        <div class="dialog-text"></div>
        <div class="dialog-hint">PRESS E / CROSS TO CONTINUE</div>
      </div>
    `;

    this.style = document.createElement('style');
    this.style.dataset.dialogStyle = 'true';
    this.style.textContent = `
      .dialog-root {
        position:absolute; inset:0; z-index:60;
        display:flex; align-items:flex-end; justify-content:center;
        padding:0 2% 4% 2%;
        background:rgba(0,0,0,.3);
        pointer-events:auto;
        font-family:'Courier New', monospace;
      }
      .dialog-root[hidden] { display:none !important; }
      
      .dialog-box {
        position:relative; width:min(800px, 90vw);
        background:#000;
        border: 4px solid #e8e1c9;
        padding: 16px 20px 24px 20px;
        image-rendering: pixelated;
        filter: contrast(1.2) saturate(0.8); 
      }
      
      .dialog-speaker {
        position:absolute; top:-12px; left:16px;
        background:#000; padding:0 8px;
        font-size:12px; letter-spacing:.1em; color:#e8e1c9;
        text-transform:uppercase;
        font-weight:bold;
      }
      
      .dialog-text {
        font-size: 14px; 
        line-height: 1.4;
        white-space: pre-wrap;
        letter-spacing: 0.05em;
        color: #ffffff;
        padding-top: 8px;
        font-family: 'Courier New', monospace;
        text-rendering: optimizeSpeed;
        -webkit-font-smoothing: none;
        font-smooth: never;
        transform: scale(0.98) translateZ(0); 
        text-shadow: 1px 1px 0 #000;
      }
      
      .dialog-text .dialog-icon {
        display:inline-flex; align-items:center; justify-content:center;
        min-width:1.6em; height:1.6em; margin:0 4px; padding:0 4px;
        background:#e8e1c9; color:#000;
        font-size:0.85em; font-weight:700;
        border:2px solid #000; 
        box-shadow:0 0 0 1px #e8e1c9;
        vertical-align:middle; image-rendering:pixelated;
        font-family:'Courier New', monospace;
      }
      
      .dialog-hint {
        position:absolute; right:16px; bottom:8px;
        font-size:9px; letter-spacing:.1em; color:#e8e1c9; opacity:.8;
      }
    `;

    this.container.appendChild(this.style);
    this.container.appendChild(this.root);
  }

  public start(pages: DialogPage[]): void {
    this.pages = pages;
    this.pageIndex = 0;
    this.open = true;
    this.root.hidden = false;
    this.renderPage();
  }

  public isOpen(): boolean {
    return this.open;
  }

  public next(): void {
    if (!this.open) return;
    this.pageIndex++;
    if (this.pageIndex >= this.pages.length) {
      this.close();
      return;
    }
    this.renderPage();
  }

  public close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.callbacks.onClose();
  }

  public destroy(): void {
    this.root.remove();
    this.style.remove();
  }

  private renderPage(): void {
    const page = this.pages[this.pageIndex];
    if (!page) return;

    const textEl = this.root.querySelector<HTMLElement>('.dialog-text');
    if (!textEl) return;

    const html = page.text.replace(/\{(\w+)\}/g, (_, key) => {
      const label = this.getIconLabel(key);
      return `<span class="dialog-icon">${label}</span>`;
    });
    textEl.innerHTML = html;
  }

  private getIconLabel(key: string): string {
    if (this.device === 'gamepad') {
      const map: Record<string, string> = {
        W: '▲', S: '▼', A: '◀', D: '▶',
        Shift: 'R2', Alt: 'R2', Mouse: 'R3', E: '✕', I: 'START',
        Cross: '✕', Circle: '○', Square: '□', Triangle: '△',
        Stick: 'L3', Start: 'START'
      };
      return map[key] ?? key;
    }

    const map: Record<string, string> = {
      W: 'W', S: 'S', A: 'A', D: 'D',
      Shift: 'SHIFT', Alt: 'ALT', Mouse: 'MOUSE', E: 'E', I: 'I',
      Cross: 'E', Circle: 'C', Square: 'X', Triangle: 'T',
      Stick: 'MOUSE', Start: 'E'
    };
    return map[key] ?? key;
  }
}