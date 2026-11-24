import {describe, expect, it} from 'vitest';
import {scanForEngineChanges} from '../../src/checks/engines.js';
import {metaCache, type PackageMetadata} from '../../src/npm.js';

function createMeta(
  name: string,
  version: string,
  node?: string
): PackageMetadata {
  return {
    name,
    version,
    engines: node ? {node} : undefined,
    _npmUser: {name: 'test', email: 'test@example.com'}
  };
}

describe('scanForEngineChanges', () => {
  it('reports when an upgraded dependency tightens its Node.js requirement', async () => {
    metaCache.set(
      'pkg-engine@1.0.0',
      createMeta('pkg-engine', '1.0.0', '>=16')
    );
    metaCache.set(
      'pkg-engine@2.0.0',
      createMeta('pkg-engine', '2.0.0', '>=18')
    );

    const messages: string[] = [];
    const baseDeps = new Map([['pkg-engine', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-engine', new Set(['2.0.0'])]]);

    await scanForEngineChanges(messages, currentDeps, baseDeps);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('## ⚠️ Node.js Engine Changes');
    expect(messages[0]).toContain('| pkg-engine@2.0.0 | >=16 | >=18 |');
  });

  it('reports a newly added Node.js requirement when the prior version had none', async () => {
    metaCache.set(
      'pkg-engine-none@1.0.0',
      createMeta('pkg-engine-none', '1.0.0')
    );
    metaCache.set(
      'pkg-engine-none@2.0.0',
      createMeta('pkg-engine-none', '2.0.0', '>=18')
    );

    const messages: string[] = [];
    const baseDeps = new Map([['pkg-engine-none', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-engine-none', new Set(['2.0.0'])]]);

    await scanForEngineChanges(messages, currentDeps, baseDeps);

    expect(messages[0]).toContain('| pkg-engine-none@2.0.0 | * | >=18 |');
  });

  it('does not report an unchanged or relaxed Node.js requirement', async () => {
    metaCache.set(
      'pkg-engine-same@1.0.0',
      createMeta('pkg-engine-same', '1.0.0', '>=18')
    );
    metaCache.set(
      'pkg-engine-same@2.0.0',
      createMeta('pkg-engine-same', '2.0.0', '>=16')
    );

    const messages: string[] = [];
    const baseDeps = new Map([['pkg-engine-same', new Set(['1.0.0'])]]);
    const currentDeps = new Map([['pkg-engine-same', new Set(['2.0.0'])]]);

    await scanForEngineChanges(messages, currentDeps, baseDeps);

    expect(messages).toHaveLength(0);
  });

  it('does not report a newly added dependency', async () => {
    metaCache.set(
      'pkg-engine-new@1.0.0',
      createMeta('pkg-engine-new', '1.0.0', '>=18')
    );

    const messages: string[] = [];
    const baseDeps = new Map<string, Set<string>>();
    const currentDeps = new Map([['pkg-engine-new', new Set(['1.0.0'])]]);

    await scanForEngineChanges(messages, currentDeps, baseDeps);

    expect(messages).toHaveLength(0);
  });
});
