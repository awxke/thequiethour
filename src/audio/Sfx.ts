import { warn } from '../core/debug';

// короткие one-shot звуки: move / select / cancel.
// Шаг — непрерывный звук ходьбы (6 сек), loop, играет пока идёшь
export class Sfx {
  private readonly cache: Record<string, HTMLAudioElement> = {};
  private readonly volume = 0.5;
  private stepInstance: HTMLAudioElement | null = null;

  private readonly paths = {
    move: '/audio/menu-move.mp3',
    select: '/audio/menu-select.mp3',
    cancel: '/audio/menu-cancel.mp3',
    step: '/audio/step.mp3'
  };

  constructor() {
    for (const [key, path] of Object.entries(this.paths)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = this.volume;
      audio.addEventListener('error', () => warn(`Sfx: не удалось загрузить ${path}`));
      this.cache[key] = audio;
    }
  }

  public playMove(): void { this.play('move'); }
  public playSelect(): void { this.play('select'); }
  public playCancel(): void { this.play('cancel'); }

  // шаг: непрерывный звук ходьбы. Если уже играет — не трогаем
  public playStep(): void {
    if (!this.stepInstance) {
      const source = this.cache.step;
      if (!source) return;
      this.stepInstance = source.cloneNode() as HTMLAudioElement;
      this.stepInstance.volume = this.volume;
      this.stepInstance.loop = true; // 6-секундный файл зациклен
    }

    if (this.stepInstance.paused) {
      this.stepInstance.play().catch(() => {
        // автоплей заблокирован — молча
      });
    }
  }

  // остановить шаг (когда перестал идти) — сразу, без затухания
  public stopStep(): void {
    if (!this.stepInstance) return;
    this.stepInstance.pause();
    this.stepInstance.currentTime = 0;
  }

  public destroy(): void {
    if (this.stepInstance) {
      this.stepInstance.pause();
      this.stepInstance.removeAttribute('src');
      this.stepInstance.load();
      this.stepInstance = null;
    }

    for (const audio of Object.values(this.cache)) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    for (const key of Object.keys(this.cache)) {
      delete this.cache[key];
    }
  }

  private play(key: string): void {
    const source = this.cache[key];
    if (!source) return;

    const clone = source.cloneNode() as HTMLAudioElement;
    clone.volume = this.volume;
    clone.play().catch(() => {
      // автоплей заблокирован — молча
    });
  }
}