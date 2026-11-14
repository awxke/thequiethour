import { startGame } from './core/game';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App container #app not found');
}

const game = startGame(app);

window.addEventListener('beforeunload', () => {
  game.destroy();
});