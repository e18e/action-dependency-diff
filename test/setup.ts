import {vi} from 'vitest';
import {coreLogs} from './util.js';

function createLogger(output: string[]): (message: string | Error) => void {
  return (message: string | Error) => {
    output.push(message.toString());
  };
}

vi.mock(import('@actions/core'), async (importModule) => {
  const mod = await importModule();
  return {
    ...mod,
    info: createLogger(coreLogs.info),
    error: createLogger(coreLogs.error),
    warning: createLogger(coreLogs.warning),
    debug: createLogger(coreLogs.debug)
  };
});
