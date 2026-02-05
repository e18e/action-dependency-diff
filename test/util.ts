export const coreLogs = {
  info: [] as string[],
  error: [] as string[],
  warning: [] as string[],
  debug: [] as string[]
};

export function clearCoreLogs() {
  coreLogs.info.length = 0;
  coreLogs.error.length = 0;
  coreLogs.warning.length = 0;
  coreLogs.debug.length = 0;
}
