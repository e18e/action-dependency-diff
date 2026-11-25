import {describe, expect, it} from 'vitest';
import {scanForInstallScripts} from '../../src/checks/install-scripts.js';
import {metaCache, type PackageMetadata} from '../../src/npm.js';

function createMeta(
  name: string,
  version: string,
  scripts?: Record<string, string>
): PackageMetadata {
  return {
    name,
    version,
    scripts,
    _npmUser: {name: 'test', email: 'test@example.com'}
  };
}

describe('scanForInstallScripts', () => {
  it('should report a newly added package with install scripts', async () => {
    metaCache.set(
      'pkg-new@1.0.0',
      createMeta('pkg-new', '1.0.0', {postinstall: 'node install.js'})
    );

    const baseDeps = new Map<string, Set<string>>();
    const currentDeps = new Map([['pkg-new', new Set(['1.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain('## ⚠️ Install Scripts Added');
    expect(result?.message).toContain(
      '| pkg-new@1.0.0 | New package | `postinstall` |'
    );
  });

  it('should report an upgraded package that introduces install scripts', async () => {
    metaCache.set('pkg-upgrade@1.0.0', createMeta('pkg-upgrade', '1.0.0'));
    metaCache.set(
      'pkg-upgrade@2.0.0',
      createMeta('pkg-upgrade', '2.0.0', {
        install: 'node-gyp rebuild',
        postinstall: 'node install.js'
      })
    );

    const baseDeps = new Map([['pkg-upgrade', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-upgrade', new Set(['2.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain(
      '| pkg-upgrade@2.0.0 | Upgraded | `install`, `postinstall` |'
    );
  });

  it('should report only scripts that were not present in the base version', async () => {
    metaCache.set(
      'pkg-added-script@1.0.0',
      createMeta('pkg-added-script', '1.0.0', {postinstall: 'node install.js'})
    );
    metaCache.set(
      'pkg-added-script@2.0.0',
      createMeta('pkg-added-script', '2.0.0', {
        preinstall: 'node preinstall.js',
        postinstall: 'node install.js'
      })
    );

    const baseDeps = new Map([['pkg-added-script', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-added-script', new Set(['2.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeDefined();
    expect(result?.message).toContain(
      '| pkg-added-script@2.0.0 | Upgraded | `preinstall` |'
    );
  });

  it('should not report when the package already had install scripts', async () => {
    metaCache.set(
      'pkg-existing@1.0.0',
      createMeta('pkg-existing', '1.0.0', {postinstall: 'node install.js'})
    );
    metaCache.set(
      'pkg-existing@2.0.0',
      createMeta('pkg-existing', '2.0.0', {postinstall: 'node install.js'})
    );

    const baseDeps = new Map([['pkg-existing', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-existing', new Set(['2.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });

  it('should ignore non-install lifecycle scripts', async () => {
    metaCache.set(
      'pkg-other-scripts@1.0.0',
      createMeta('pkg-other-scripts', '1.0.0', {
        build: 'node build.js',
        prepare: 'node prepare.js',
        test: 'node test.js'
      })
    );

    const baseDeps = new Map<string, Set<string>>();
    const currentDeps = new Map([['pkg-other-scripts', new Set(['1.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });

  it('should skip packages with no metadata', async () => {
    metaCache.set('pkg-missing@1.0.0', null);

    const baseDeps = new Map<string, Set<string>>();
    const currentDeps = new Map([['pkg-missing', new Set(['1.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });

  it('should not report packages that were not upgraded', async () => {
    metaCache.set(
      'pkg-unchanged@1.0.0',
      createMeta('pkg-unchanged', '1.0.0', {postinstall: 'node install.js'})
    );

    const baseDeps = new Map([['pkg-unchanged', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-unchanged', new Set(['1.0.0'])]]);

    const result = await scanForInstallScripts(currentDeps, baseDeps);

    expect(result).toBeUndefined();
  });
});
