import {describe, expect, it} from 'vitest';
import {scanForReplacements} from '../../src/checks/replacements.js';

describe('scanForReplacements', () => {
  it('should report replacement for newly added dependency', () => {
    const baseDeps = new Map<string, string>();
    const currentDeps = new Map<string, string>([['is-odd', '^3.0.0']]);

    const result = scanForReplacements(baseDeps, currentDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain('is-odd');
  });

  it('should not report replacement if dependency already existed in base', () => {
    const baseDeps = new Map<string, string>([['is-odd', '^3.0.0']]);
    const currentDeps = new Map<string, string>([['is-odd', '^3.0.1']]);

    const result = scanForReplacements(baseDeps, currentDeps);

    expect(result).toBeUndefined();
  });
});
