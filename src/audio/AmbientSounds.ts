// фоновые звуки комнаты: жужжание лампы. loop, низкая громкость
export class AmbientSounds {
  private readonly lamp: HTMLAudioElement;
  private started = false;

  constructor() {
    this.lamp = new Audio('/audio/lamp-hum.mp3');
    this.lamp.loop = true;
    this.lamp.volume = 0.12;
    this.lamp.preload = 'auto';
    this.lamp.addEventListener('error', () => {
      // файла нет — молча, игра работает без гула
    });
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.lamp.play().catch(() => {
      // автоплей заблокирован — попробуем после первого действия
      this.started = false;
    });
  }

  public stop(): void {
    this.lamp.pause();
    this.lamp.currentTime = 0;
    this.started = false;
  }

  public update(_delta: number): void {
    // пока нечего обновлять
  }

  public destroy(): void {
    this.lamp.pause();
    this.lamp.removeAttribute('src');
    this.lamp.load();
    this.started = false;
  }
}