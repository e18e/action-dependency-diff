import {describe, expect, it} from 'vitest';
import {scanForDependencyCount} from '../../src/checks/dependency-count.js';

describe('scanForDependencyCount', () => {
  const baseDeps = new Map([['pkg-a', new Set(['1.0.0'])]]);

  it('should report an increase over the threshold as breached', () => {
    const currentDeps = new Map([
      ['pkg-a', new Set(['1.0.0'])],
      ['pkg-b', new Set(['1.0.0'])]
    ]);

    const result = scanForDependencyCount(1, currentDeps, baseDeps);

    expect(result?.message).toContain('This PR adds 1 new dependencies');
    expect(result?.breached).toBe(true);
  });

  it('should not report an increase below the threshold', () => {
    const currentDeps = new Map([
      ['pkg-a', new Set(['1.0.0'])],
      ['pkg-b', new Set(['1.0.0'])]
    ]);

    expect(scanForDependencyCount(2, currentDeps, baseDeps)).toBeUndefined();
  });

  it('should not mark it as breached without an increase when the threshold is 0', () => {
    const result = scanForDependencyCount(0, baseDeps, baseDeps);

    expect(result?.breached).toBe(false);
  });
});
