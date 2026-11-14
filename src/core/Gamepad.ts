export interface GamepadConfig {
  axisLeftX: number;
  axisLeftY: number;
  axisRightX: number;
  axisRightY: number;
  buttonCross: number;
  buttonCircle: number;
  buttonStart: number;
  buttonSelect: number;
  buttonSprint: number;
}

export interface GamepadState {
  connected: boolean;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  crossPressed: boolean;
  circlePressed: boolean;
  startPressed: boolean;
  selectPressed: boolean;
  sprintHeld: boolean;
  gamepadUsed: boolean;
}

const DEFAULT_CONFIG: GamepadConfig = {
  axisLeftX: 0,
  axisLeftY: 1,
  axisRightX: 2,
  axisRightY: 4,
  buttonCross: 0,
  buttonCircle: 1,
  buttonStart: 9,
  buttonSelect: 8,
  buttonSprint: 7
};

const DEAD_ZONE = 0.35;

export class Gamepad {
  private config: GamepadConfig;
  private index: number | null = null;
  private prevButtons: boolean[] = [];
  private lastInputWasGamepad = false;
  
  // Флаг, чтобы не спамить автоопределением
  private isCalibrated = false;

  constructor(config: Partial<GamepadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    window.addEventListener('gamepadconnected', e => {
      this.index = e.gamepad.index;
      this.isCalibrated = false;
      console.log(`[Gamepad] Подключён: ${e.gamepad.id} - Gamepad.ts:56`);
      this.autoCalibrate(e.gamepad);
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.index = null;
      this.isCalibrated = false;
    });
  }

  public markKeyboardUsed(): void {
    this.lastInputWasGamepad = false;
  }

  public wasGamepadUsed(): boolean {
    return this.lastInputWasGamepad;
  }

  public read(): GamepadState {
    const state: GamepadState = {
      connected: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      crossPressed: false, circlePressed: false, startPressed: false, selectPressed: false,
      sprintHeld: false, gamepadUsed: false
    };

    if (this.index === null) return state;

    const pad = navigator.getGamepads()[this.index];
    if (!pad) return state;

    state.connected = true;

    // 1. Читаем оси
    const rawLeftX = pad.axes[this.config.axisLeftX] ?? 0;
    const rawLeftY = pad.axes[this.config.axisLeftY] ?? 0;
    const rawRightX = pad.axes[this.config.axisRightX] ?? 0;
    const rawRightY = pad.axes[this.config.axisRightY] ?? 0;

    const [mx, my] = this.applyDeadZoneVec(rawLeftX, rawLeftY);
    const [lx, ly] = this.applyDeadZoneVec(rawRightX, rawRightY);
    
    state.moveX = mx;
    state.moveY = my;
    state.lookX = lx;
    state.lookY = ly;

    // 2. Читаем кнопки
    state.crossPressed = this.wasPressed(pad, this.config.buttonCross);
    state.circlePressed = this.wasPressed(pad, this.config.buttonCircle);
    state.startPressed = this.wasPressed(pad, this.config.buttonStart);
    state.selectPressed = this.wasPressed(pad, this.config.buttonSelect);

    // 3. Бег (R2 или R1)
    const sprintR2 = pad.buttons[this.config.buttonSprint];
    const sprintR1 = pad.buttons[5];
    state.sprintHeld = 
      (sprintR2 ? (sprintR2.pressed || sprintR2.value > 0.5) : false) ||
      (sprintR1 ? sprintR1.pressed : false);

    if (state.moveX !== 0 || state.moveY !== 0 || state.lookX !== 0 || state.lookY !== 0 ||
        state.crossPressed || state.circlePressed || state.startPressed || state.selectPressed || state.sprintHeld) {
      this.lastInputWasGamepad = true;
      state.gamepadUsed = true;
    }

    return state;
  }

  // Пытаемся понять, какая кнопка нажата первой, и какая ось в покое = 0
  private autoCalibrate(pad: Gamepad) {
    if (this.isCalibrated) return;

    // Ищем нажатую кнопку (если пользователь сразу нажал крест, мы это увидим)
    const pressedButtonIndex = pad.buttons.findIndex(b => b.pressed);
    
    if (pressedButtonIndex !== -1) {
      // Если нажата кнопка 0, а мы думали что это крест, но на самом деле это может быть что угодно.
      // Но если нажата кнопка 1, а мы ждем крест на 0, меняем местами.
      if (pressedButtonIndex === 1) {
        console.log('[Gamepad] Автоопределение: кнопка 1 нажата. Меняю Cross и Circle местами. - Gamepad.ts:135');
        this.config.buttonCross = 1;
        this.config.buttonCircle = 0;
      } else if (pressedButtonIndex === 0) {
        // Если нажали 0, скорее всего это и есть крест, оставляем как есть
        console.log('[Gamepad] Автоопределение: кнопка 0 нажата. Оставляю Cross на 0. - Gamepad.ts:140');
      }
      this.isCalibrated = true;
      return;
    }

    // Проверяем оси правого стика. Если ось 4 в покое не ноль, ищем другую.
    const restY = Math.abs(pad.axes[this.config.axisRightY] ?? 0);
    const restX = Math.abs(pad.axes[this.config.axisRightX] ?? 0);

    if (restX < 0.1 && restY < 0.1) {
      // Всё ок, оси на месте
      this.isCalibrated = true;
      return;
    }

    // Если ось Y (4) в покое -1, ищем другую ось, которая в покое близка к 0
    if (restY > 0.5) {
      console.log('[Gamepad] Ось 4 в покое не ноль. Ищу замену для правого Y... - Gamepad.ts:158');
      for (let i = 2; i < pad.axes.length; i++) {
        if (i === this.config.axisLeftX || i === this.config.axisLeftY) continue;
        if (Math.abs(pad.axes[i]) < 0.1) {
          console.log(`[Gamepad] Нашёл ось ${i} для правого Y. - Gamepad.ts:162`);
          this.config.axisRightY = i;
          break;
        }
      }
    }
    
    this.isCalibrated = true;
  }

  private applyDeadZoneVec(x: number, y: number): [number, number] {
    const len = Math.sqrt(x * x + y * y);
    if (len < DEAD_ZONE) return [0, 0];
    const scale = (len - DEAD_ZONE) / (1 - DEAD_ZONE) / len;
    return [x * scale, y * scale];
  }

  private wasPressed(pad: Gamepad, index: number): boolean {
    const button = pad.buttons[index];
    if (!button) return false;
    const now = button.pressed;
    const prev = this.prevButtons[index] ?? false;
    this.prevButtons[index] = now;
    return now && !prev;
  }
}