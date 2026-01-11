import {describe, expect, it, afterEach} from 'vitest';
import {scanForDependencySize} from '../../src/checks/dependency-size.js';
import {coreLogs, clearCoreLogs} from '../util.js';
import type {ParsedLockFile} from 'lockparse';

function createMockObjects(
  fromDependencies: Record<string, string[]>,
  toDependencies: Record<string, string[]>
): {
  currentDeps: Map<string, Set<string>>;
  baseDeps: Map<string, Set<string>>;
  currentLockFile: ParsedLockFile;
  baseLockFile: ParsedLockFile;
} {
  const baseDeps = new Map<string, Set<string>>([]);
  const currentDeps = new Map<string, Set<string>>([]);
  const currentLockFile: ParsedLockFile = {
    type: 'npm',
    packages: [],
    root: {
      name: 'root-package',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    }
  };
  const baseLockFile: ParsedLockFile = {
    type: 'npm',
    packages: [],
    root: {
      name: 'root-package',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    }
  };

  for (const [depName, versions] of Object.entries(fromDependencies)) {
    baseDeps.set(depName, new Set(versions));
    for (const version of versions) {
      baseLockFile.packages.push({
        name: depName,
        version: version,
        dependencies: [],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      });
    }
  }

  for (const [depName, versions] of Object.entries(toDependencies)) {
    currentDeps.set(depName, new Set(versions));
    for (const version of versions) {
      currentLockFile.packages.push({
        name: depName,
        version: version,
        dependencies: [],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      });
    }
  }
  return {currentDeps, baseDeps, currentLockFile, baseLockFile};
}

describe('scanForDependencySize', () => {
  afterEach(() => {
    clearCoreLogs();
  });

  it('should do nothing if no dependency changes', async () => {
    const messages: string[] = [];
    const threshold = 1;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects({}, {});

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toHaveLength(0);
  });

  it('should report new dependencies exceeding the threshold', async () => {
    const messages: string[] = [];
    const threshold = 1000;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects(
        {},
        {
          typescript: ['5.9.3']
        }
      );

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toMatchSnapshot();
    expect(coreLogs).toMatchSnapshot();
  });

  it('should report removals when threshold is -1', async () => {
    const messages: string[] = [];
    const threshold = -1;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects(
        {
          tinyexec: ['1.0.0']
        },
        {}
      );

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toMatchSnapshot();
    expect(coreLogs).toMatchSnapshot();
  });

  it('should not report changes below the threshold', async () => {
    const messages: string[] = [];
    const threshold = 50_000;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects(
        {},
        {
          tinyexec: ['1.0.0']
        }
      );

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toHaveLength(0);
    expect(coreLogs).toMatchSnapshot();
  });

  it('should report upgrades on one line', async () => {
    const messages: string[] = [];
    const threshold = 1;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects(
        {
          chai: ['5.0.2']
        },
        {
          chai: ['5.0.3']
        }
      );

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toMatchSnapshot();
    expect(coreLogs).toMatchSnapshot();
  });

  it('should report negative upgrades on one line', async () => {
    const messages: string[] = [];
    const threshold = -1;
    const {currentDeps, baseDeps, currentLockFile, baseLockFile} =
      createMockObjects(
        {
          chai: ['5.0.0']
        },
        {
          chai: ['5.0.2']
        }
      );

    await scanForDependencySize(
      messages,
      threshold,
      currentDeps,
      baseDeps,
      currentLockFile,
      baseLockFile
    );

    expect(messages).toMatchSnapshot();
    expect(coreLogs).toMatchSnapshot();
  });
});
