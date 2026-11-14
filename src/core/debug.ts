// log / warn / error: в dev логи видны, в prod молчат, ошибки — всегда
const DEBUG = import.meta.env.DEV;

export const log = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};

export const warn = (...args: unknown[]): void => {
  if (DEBUG) console.warn(...args);
};

export const error = (...args: unknown[]): void => {
  console.error(...args);
};