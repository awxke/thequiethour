import { log, warn, error } from '../core/debug';

// плейлист: track1 → track2 → track3 → track1. Запускается после первого клика
export class AudioManager {
  private readonly tracks: HTMLAudioElement[] = [];
  private currentIndex = 0;
  private started = false;

  constructor(
    private readonly volume = 0.075,
    private readonly trackPaths: string[] = [
      '/audio/track1.mp3',
      '/audio/track2.mp3',
      '/audio/track3.mp3'
    ]
  ) {
    this.tracks = trackPaths.map(path => {
      const audio = new Audio(path);
      audio.volume = this.volume;
      audio.preload = 'auto';
      audio.loop = false;

      audio.addEventListener('ended', () => this.playNext());
      audio.addEventListener('error', () => error(`Не удалось загрузить аудиофайл: ${path}`));

      return audio;
    });
  }

  public async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.currentIndex = 0;
    await this.playCurrent();
  }

  public stop(): void {
    this.tracks.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.started = false;
  }

  public setVolume(value: number): void {
    this.tracks.forEach(audio => { audio.volume = value; });
  }

  public destroy(): void {
    this.tracks.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    });
    this.tracks.length = 0;
    this.started = false;
  }

  private async playCurrent(): Promise<void> {
    const audio = this.tracks[this.currentIndex];
    if (!audio) return;

    audio.volume = this.volume;

    try {
      await audio.play();
      log(`Играет трек ${this.currentIndex + 1}`);
    } catch (cause) {
      warn('Не удалось запустить музыку', cause);
    }
  }

  private playNext(): void {
    if (!this.started) return;

    this.currentIndex++;
    if (this.currentIndex >= this.tracks.length) {
      this.currentIndex = 0;
    }
    void this.playCurrent();
  }
}