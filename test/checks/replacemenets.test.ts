import {describe, expect, it} from 'vitest';
import {scanForReplacements} from '../../src/checks/replacements.js';

describe('scanForReplacements', () => {
  it('should report replacement for newly added dependency', () => {
    const messages: string[] = [];
    const baseDeps = new Map<string, string>();
    const currentDeps = new Map<string, string>([['is-odd', '^3.0.0']]);

    scanForReplacements(messages, baseDeps, currentDeps);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('is-odd');
  });

  it('should not report replacement if dependency already existed in base', () => {
    const messages: string[] = [];
    const baseDeps = new Map<string, string>([['is-odd', '^3.0.0']]);
    const currentDeps = new Map<string, string>([['is-odd', '^3.0.1']]);

    scanForReplacements(messages, baseDeps, currentDeps);

    expect(messages).toHaveLength(0);
  });

  it('should ignore dependencies matching excludeDependencies patterns', () => {
    const messages: string[] = [];
    const baseDeps = new Map<string, string>();
    const currentDeps = new Map<string, string>([
      ['is-odd', '^3.0.0'],
      ['is-even', '^1.0.0'],
      ['array-includes', '^3.1.0']
    ]);

    scanForReplacements(messages, baseDeps, currentDeps, {
      excludeDependencies: ['is-*', 'array-includes']
    });

    expect(messages).toHaveLength(0);
  });
});
