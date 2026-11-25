import {describe, expect, it} from 'vitest';
import {scanForLicenses} from '../../src/checks/license.js';
import {metaCache, type PackageMetadata} from '../../src/npm.js';

function createMeta(
  name: string,
  version: string,
  license?: string
): PackageMetadata {
  return {
    name,
    version,
    license,
    _npmUser: {name: 'test', email: 'test@example.com'}
  };
}

describe('scanForLicenses', () => {
  it('should report when a dependency changes its license between versions', async () => {
    metaCache.set('pkg-a@1.0.0', createMeta('pkg-a', '1.0.0', 'MIT'));
    metaCache.set('pkg-a@2.0.0', createMeta('pkg-a', '2.0.0', 'GPL-3.0'));

    const baseDeps = new Map([['pkg-a', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-a', new Set(['2.0.0'])]]);

    const result = await scanForLicenses(currentDeps, baseDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain('## ⚠️ License Changes');
    expect(result?.message).toContain('| pkg-a@2.0.0 | MIT | GPL-3.0 |');
  });

  it('should not report when license is unchanged or differs by case', async () => {
    metaCache.set('pkg-a@1.0.0', createMeta('pkg-a', '1.0.0', 'mit'));
    metaCache.set('pkg-a@2.0.0', createMeta('pkg-a', '2.0.0', 'MIT'));

    const baseDeps = new Map([['pkg-a', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-a', new Set(['2.0.0'])]]);

    const result = await scanForLicenses(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });

  it('should not report for newly added dependencies that were not in base', async () => {
    metaCache.set('pkg-a@1.0.0', createMeta('pkg-a', '1.0.0', 'GPL-3.0'));

    const baseDeps = new Map<string, Set<string>>();
    const currentDeps = new Map([['pkg-a', new Set(['1.0.0'])]]);

    const result = await scanForLicenses(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });

  it('should report Unknown when the new version drops its license field', async () => {
    metaCache.set('pkg-a@1.0.0', createMeta('pkg-a', '1.0.0', 'MIT'));
    metaCache.set('pkg-a@2.0.0', createMeta('pkg-a', '2.0.0', undefined));

    const baseDeps = new Map([['pkg-a', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-a', new Set(['2.0.0'])]]);

    const result = await scanForLicenses(currentDeps, baseDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain('| pkg-a@2.0.0 | MIT | Unknown |');
  });
});
