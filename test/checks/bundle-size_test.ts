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

  it('should never warn about a pure size decrease, no matter how large', async () => {
    const messages: string[] = [];
    // sizeChange is signed: (sourceSize - baseSize) = negative for a shrink
    // A massive decrease should never cross a positive threshold
    const basePacks = [makePack('my-package', 1000000)];
    const sourcePacks = [makePack('my-package', 1)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(0);
  });

  it('should warn even when net total change is negative due to a large decrease masking an increase', async () => {
    const messages: string[] = [];
    // pkg-a shrinks by 500 KB, pkg-b grows by 100 KB → net = -400 KB
    // Without filtering to increases only, -400 KB < 50 KB threshold → silent (wrong)
    const basePacks = [makePack('pkg-a', 500000), makePack('pkg-b', 50000)];
    const sourcePacks = [makePack('pkg-a', 0), makePack('pkg-b', 150000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('pkg-b');
    expect(messages[0]).not.toContain('pkg-a');
  });

  it('should sum multiple increases when checking against the threshold', async () => {
    const messages: string[] = [];
    // Each increase is 30 KB (below the 50 KB threshold individually)
    // but combined they are 60 KB (above threshold) → should warn
    const basePacks = [makePack('pkg-a', 100000), makePack('pkg-b', 100000)];
    const sourcePacks = [makePack('pkg-a', 130000), makePack('pkg-b', 130000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('pkg-a');
    expect(messages[0]).toContain('pkg-b');
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

  it('should warn about an increase even when a decrease in another package cancels it out in total', async () => {
    const messages: string[] = [];
    // pkg-a shrinks by 100 KB, pkg-b grows by 100 KB → net = 0, but pkg-b exceeds threshold
    const basePacks = [makePack('pkg-a', 200000), makePack('pkg-b', 50000)];
    const sourcePacks = [makePack('pkg-a', 100000), makePack('pkg-b', 150000)];

    await scanForBundleSize(messages, basePacks, sourcePacks, 50000);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('pkg-b');
    expect(messages[0]).not.toContain('pkg-a');
    expect(messages).toMatchSnapshot();
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
