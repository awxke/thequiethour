import * as THREE from 'three';
import { Scene } from './Scene';
import { Renderer } from './Renderer';
import { Gamepad } from './Gamepad';
import { Room } from '../world/Room';
import { Lighting } from '../world/Lighting';
import { Player, type PlayerInput } from '../player/Player';
import { CameraController } from '../player/CameraController';
import { CollisionController } from '../player/CollisionController';
import { MainMenu } from '../ui/MainMenu';
import { Intro } from '../ui/Intro';
import { Hud } from '../ui/Hud';
import { Inventory } from '../ui/Inventory';
import { Dialog } from '../ui/Dialog';
import { DialogPrompt } from '../world/DialogPrompt';
import { AudioManager } from '../audio/AudioManager';
import { AmbientSounds } from '../audio/AmbientSounds';
import { Sfx } from '../audio/Sfx';
import { log, error } from './debug';

export interface GameHandle {
  destroy(): void;
}

const ITEM_ORDER = ['energy', 'light', 'none', 'none', 'none'] as const;
const NPC_POSITION = new THREE.Vector3(0, 0, 1.5);
const DIALOG_RADIUS = 2.0;
const SPAWN_X = -0.77;
const SPAWN_Z = -5.13;

export function startGame(container: HTMLDivElement): GameHandle {
  const scene = new Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.05,
    100
  );
  camera.rotation.order = 'YXZ';
  camera.position.set(SPAWN_X, 1.08, SPAWN_Z);
  scene.add(camera);

  const renderer = new Renderer(container, scene.three, camera);
  const lighting = new Lighting(scene.three, renderer.webgl, camera);

  const room = new Room();
  scene.add(room.getObject());

  const player = new Player();
  const cameraCtrl = new CameraController(camera);
  const collision = new CollisionController(room);
  const gamepad = new Gamepad();
  const audio = new AudioManager();
  const ambient = new AmbientSounds();
  const sfx = new Sfx();

  const keys: Record<string, boolean> = {};

  let gameStarted = false;
  let selectedIndex = 2;
  let menuCameraSet = false;
  let menu: MainMenu | null = null;
  let dialogOpen = false;
  let dialog: Dialog | null = null;

  const hud = new Hud(container, ITEM_ORDER, selectedIndex);
  const inventory = new Inventory(container, camera, ITEM_ORDER, selectedIndex, {
    onSelect: index => { selectedIndex = index; hud.setSelected(index); },
    onUse: () => { player.energyBoostTimer = player.energyBoostDuration; },
    onCandleToggle: on => lighting.setCandleMode(on),
    onIconReady: (name, dataUrl) => hud.setItemIcon(name, dataUrl)
  });

  const dialogPrompt = new DialogPrompt(NPC_POSITION, 1.4);
  scene.add(dialogPrompt.sprite);

  const buildDialogPages = (device: 'keyboard' | 'gamepad'): { text: string }[] => {
    if (device === 'gamepad') {
      return [
        { text: 'Oh. You are awake.\n\nUse the left stick to move around.' },
        { text: 'Look around with the right stick.\n\nR2 — run.' },
        { text: 'Press START to open inventory.\n\nPress CIRCLE to change slots.' },
        { text: 'Press CROSS to take the candle.\n\nIt will light your way.' },
        { text: 'Be careful in the dark.\n\nSome things are better left unseen.' }
      ];
    }
    return [
      { text: 'Oh. You are awake.\n\nUse {W} {A} {S} {D} to move around.' },
      { text: 'Look around with the {Mouse}.\n\nHold {Shift} or {Alt} to run.' },
      { text: 'Press {I} to open inventory.\n\nUse {1} {2} {3} {4} {5} to change slots.' },
      { text: 'Press {E} to take the candle.\n\nIt will light your way.' },
      { text: 'Be careful in the dark.\n\nSome things are better left unseen.' }
    ];
  };

  const isNearNpc = (): boolean => {
    const dx = player.position.x - NPC_POSITION.x;
    const dz = player.position.z - NPC_POSITION.z;
    return dx * dx + dz * dz < DIALOG_RADIUS * DIALOG_RADIUS;
  };

  const openDialog = (): void => {
    if (dialogOpen) return;
    dialogOpen = true;
    if (document.pointerLockElement === renderer.webgl.domElement) {
      document.exitPointerLock();
    }
    const device = gamepad.wasGamepadUsed() ? 'gamepad' : 'keyboard';
    dialog = new Dialog(container, device, {
      onClose: () => {
        dialogOpen = false;
        dialog?.destroy();
        dialog = null;
        renderer.webgl.domElement.requestPointerLock();
      }
    });
    dialog.start(buildDialogPages(device));
  };

  const createMenu = (): MainMenu => {
    return new MainMenu(container, sfx, {
      onStart: () => {
        gameStarted = true;
        hud.show();
        menu?.destroy();
        menu = null;
        player.position.set(SPAWN_X, player.eyeHeight, SPAWN_Z);
        camera.position.copy(player.position);
        cameraCtrl.yaw = 0;
        cameraCtrl.pitch = 0;
        camera.rotation.set(0, 0, 0);
        renderer.webgl.domElement.requestPointerLock();
        audio.stop();
        ambient.start();
      },
      onBrightnessChange: mode => lighting.setBrightness(mode)
    });
  };

  const intro = new Intro(container, {
    onComplete: () => {
      intro.destroy();
      menu = createMenu();
      void audio.start();
    }
  });

  const handleKeyDown = (e: KeyboardEvent): void => {
    gamepad.markKeyboardUsed();

    if (!gameStarted) return;

    if (dialogOpen && dialog) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') {
        dialog.next();
        e.preventDefault();
      }
      return;
    }

    if (e.code === 'KeyE' && !e.repeat) {
      if (isNearNpc()) {
        openDialog();
        e.preventDefault();
        return;
      }
      if (ITEM_ORDER[selectedIndex] === 'energy') {
        player.energyBoostTimer = player.energyBoostDuration;
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'KeyI' && !e.repeat) {
      inventory.toggle();
      if (inventory.isOpen()) {
        if (document.pointerLockElement === renderer.webgl.domElement) {
          document.exitPointerLock();
        }
      } else {
        renderer.webgl.domElement.requestPointerLock();
      }
      e.preventDefault();
      return;
    }

    if (inventory.isOpen()) {
      if (!e.repeat && /^Digit[1-5]$/.test(e.code)) {
        inventory.select(Number(e.code.slice(-1)) - 1);
      }
      if (!e.repeat && e.code === 'KeyE') {
        player.energyBoostTimer = player.energyBoostDuration;
      }
      if (e.code === 'Escape') inventory.toggle();
      e.preventDefault();
      return;
    }

    if (!e.repeat && /^Digit[1-5]$/.test(e.code)) {
      inventory.select(Number(e.code.slice(-1)) - 1);
    }
    
    keys[e.code] = true;
  };

  const handleKeyUp = (e: KeyboardEvent): void => { keys[e.code] = false; };

  const handleMouseMove = (e: MouseEvent): void => {
    gamepad.markKeyboardUsed();
    if (!gameStarted) return;
    if (dialogOpen) return;
    if (document.pointerLockElement !== renderer.webgl.domElement) return;
    cameraCtrl.onMouseMove(e.movementX, e.movementY);
  };

  const handleClick = (): void => {
    if (!gameStarted) return;
    if (dialogOpen) return;
    if (document.pointerLockElement !== renderer.webgl.domElement) {
      renderer.webgl.domElement.requestPointerLock();
    }
  };

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (dialogOpen) return;
    cameraCtrl.onWheel(e.deltaY);
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('mousemove', handleMouseMove);
  renderer.webgl.domElement.addEventListener('click', handleClick);
  renderer.webgl.domElement.addEventListener('wheel', handleWheel, { passive: false });

  room.load().then(() => {
    player.position.set(SPAWN_X, player.eyeHeight, SPAWN_Z);
    camera.position.copy(player.position);

    if (!menuCameraSet) {
      const bounds = new THREE.Box3().setFromObject(room.getObject());
      const center = bounds.getCenter(new THREE.Vector3());
      camera.fov = 43;
      camera.position.set(center.x + 4, 1.7, center.z - 4.2);
      camera.lookAt(center.x - 1.8, 1.05, center.z + 1.5);
      camera.updateProjectionMatrix();
      cameraCtrl.yaw = camera.rotation.y;
      cameraCtrl.pitch = camera.rotation.x;
      menuCameraSet = true;
    }

    log('Игрок поставлен в комнату:', player.position);
  }).catch(cause => error('Room.load() упал', cause));

  const timer = new THREE.Timer();
  let animationId = 0;

  const animate = (): void => {
    animationId = requestAnimationFrame(animate);
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    const pad = gamepad.read();

    if (menu && !gameStarted) {
      menu.handleGamepad({
        moveY: pad.moveY,
        crossPressed: pad.crossPressed,
        startPressed: pad.startPressed
      });
    }

    if (dialogOpen && dialog) {
      if (pad.crossPressed || pad.startPressed) {
        dialog.next();
      }
      sfx.stopStep();
      room.update(delta);
      lighting.update(delta);
      hud.update(delta, camera.position);
      renderer.render();
      return;
    }

    if (gameStarted) {
      dialogPrompt.setDevice(gamepad.wasGamepadUsed() ? 'gamepad' : 'keyboard');
      dialogPrompt.update(player.position, DIALOG_RADIUS, dialogOpen || inventory.isOpen());

      if (!inventory.isOpen() && pad.crossPressed && isNearNpc()) {
        openDialog();
        sfx.playSelect();
      } else if (!inventory.isOpen() && !dialogOpen) {
        if (pad.circlePressed) {
          inventory.cycle(1);
          sfx.playMove();
        }
        if (pad.crossPressed && ITEM_ORDER[selectedIndex] === 'energy') {
          player.energyBoostTimer = player.energyBoostDuration;
        }
      }
    }

    if (gameStarted && !inventory.isOpen() && !dialogOpen) {
      const altSprint = !!keys['CapsLock'] || !!keys['AltLeft'] || !!keys['AltRight'];
      const input: PlayerInput = {
        forward: !!keys['KeyW'] || pad.moveY < -0.3,
        back: !!keys['KeyS'] || pad.moveY > 0.3,
        left: !!keys['KeyA'] || pad.moveX < -0.3,
        right: !!keys['KeyD'] || pad.moveX > 0.3,
        sprint: !!(keys['ShiftLeft'] || keys['ShiftRight']) || altSprint || pad.sprintHeld,
        moveX: pad.moveX,
        moveY: pad.moveY
      };

      cameraCtrl.onGamepadLook(pad.lookX, pad.lookY, delta);
      cameraCtrl.update(delta);

      const direction = new THREE.Vector3();
      const forward = new THREE.Vector3(-Math.sin(cameraCtrl.yaw), 0, -Math.cos(cameraCtrl.yaw));
      const right = new THREE.Vector3(Math.cos(cameraCtrl.yaw), 0, -Math.sin(cameraCtrl.yaw));

      if (input.forward) direction.add(forward);
      if (input.back) direction.sub(forward);
      if (input.right) direction.add(right);
      if (input.left) direction.sub(right);

      const moving = direction.lengthSq() > 0;
      if (moving) {
        direction.normalize();
        const speed = player.getSpeed(input);
        const movement = direction.multiplyScalar(speed * delta);
        const next = collision.tryMove(player.position, movement);
        player.position.x = next.x;
        player.position.z = next.z;
      }

      player.updateTimers(delta);
      player.updateWalk(delta, moving);

      if (moving) {
        sfx.playStep();
      } else {
        sfx.stopStep();
      }

      camera.position.set(player.position.x, player.getCameraY(), player.position.z);
    } else {
      sfx.stopStep();
    }

    room.update(delta);
    lighting.update(delta);
    inventory.update(delta);
    ambient.update(delta);
    hud.update(delta, camera.position);

    renderer.render();
  };

  const handleResize = (): void => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.resize();
  };

  window.addEventListener('resize', handleResize);
  renderer.resize();
  log('The Quiet Hour: фикс E (энергетик)');
  animate();

  return {
    destroy: (): void => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.webgl.domElement.removeEventListener('click', handleClick);
      renderer.webgl.domElement.removeEventListener('wheel', handleWheel);
      intro.destroy();
      menu?.destroy();
      dialog?.destroy();
      dialogPrompt.destroy();
      hud.destroy();
      inventory.destroy();
      audio.destroy();
      ambient.destroy();
      sfx.destroy();
      room.destroy();
      lighting.dispose();
      renderer.dispose();
    }
  };
}