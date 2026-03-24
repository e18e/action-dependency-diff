import {describe, expect, it} from 'vitest';
import {scanForBundleSize} from '../../src/checks/bundle-size.js';
import type {PackInfo} from '../../src/packs.js';

function makePack(packageName: string, size: number): PackInfo {
  return {
    name: `${packageName}-1.0.0.tgz`,
    packageName,
    path: `/tmp/${packageName}-1.0.0.tgz`,
    size
  };
}

describe('scanForBundleSize', () => {
  it('should do nothing when no packs are provided', async () => {
    const messages: string[] = [];
    await scanForBundleSize(messages, [], [], 50000);
    expect(messages).toHaveLength(0);
  });

  it('should report no bundle size change when diff is 0', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 100000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should report no bundle size change with threshold=-1 when diff is 0', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 100000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, -1);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('No bundle size changes');
    expect(messages).toMatchSnapshot();
  });

  it('should not report anything when diff is 0 and threshold is not -1', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 100000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should warn about size increase exceeding threshold', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 200000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toMatchSnapshot();
  });

  it('should not warn about size increase below threshold', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 120000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should not report no-change when individual changes cancel out', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('pkg-a', 200000), makePack('pkg-b', 50000)];
    const sourcePacks = [makePack('pkg-a', 100000), makePack('pkg-b', 150000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should not report no-change when changes exist but are below threshold', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 120000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should celebrate size decrease when threshold is -1', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 200000)];
    const sourcePacks = [makePack('my-package', 100000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, -1);

    expect(messages).toMatchSnapshot();
  });

  it('should show both decreases and increases when threshold is -1', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('pkg-a', 200000), makePack('pkg-b', 50000)];
    const sourcePacks = [makePack('pkg-a', 100000), makePack('pkg-b', 150000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, -1);

    expect(messages).toHaveLength(1);
    expect(messages).toMatchSnapshot();
  });

  it('should show only increases when threshold is -1 and no decreases', async () => {
    const messages: string[] = [];
    const basePacks = [makePack('my-package', 100000)];
    const sourcePacks = [makePack('my-package', 200000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, -1);

    expect(messages).toMatchSnapshot();
  });
});
