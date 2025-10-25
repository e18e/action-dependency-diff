import {describe, expect, it} from 'vitest';
import {scanForDuplicates} from '../../src/checks/duplicates.js';
import type {ParsedLockFile, ParsedDependency} from 'lockparse';

describe('scanForDuplicates', () => {
  it('should do nothing if no duplicates are found', () => {
    const messages: string[] = [];
    const threshold = 1;
    const dependencyMap = new Map<string, Set<string>>([
      ['package-a', new Set(['1.0.0'])],
      ['package-b', new Set(['2.0.0'])]
    ]);
    const lockfilePath = 'package-lock.json';
    const lockfile: ParsedLockFile = {
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

    scanForDuplicates(
      messages,
      threshold,
      dependencyMap,
      lockfilePath,
      lockfile
    );

    expect(messages).toHaveLength(0);
  });

  it('should report duplicates when threshold is exceeded', () => {
    const messages: string[] = [];
    const threshold = 1;
    const dependencyMap = new Map<string, Set<string>>([
      ['package-a', new Set(['1.0.0', '1.1.0'])],
      ['package-b', new Set(['2.0.0'])]
    ]);
    const lockfilePath = 'package-lock.json';
    const packageA: ParsedDependency = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageAAlt: ParsedDependency = {
      name: 'package-a',
      version: '1.1.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageB: ParsedDependency = {
      name: 'package-b',
      version: '2.0.0',
      dependencies: [packageAAlt],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const lockfile: ParsedLockFile = {
      type: 'npm',
      packages: [packageA, packageAAlt, packageB],
      root: {
        name: 'root-package',
        version: '1.0.0',
        dependencies: [packageA, packageB],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    scanForDuplicates(
      messages,
      threshold,
      dependencyMap,
      lockfilePath,
      lockfile
    );

    expect(messages).toMatchSnapshot();
  });

  it('should do nothing when duplicates are below threshold', () => {
    const messages: string[] = [];
    const threshold = 2;
    const dependencyMap = new Map<string, Set<string>>([
      ['package-a', new Set(['1.0.0', '1.1.0'])],
      ['package-b', new Set(['2.0.0'])]
    ]);
    const lockfilePath = 'package-lock.json';
    const packageA: ParsedDependency = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageAAlt: ParsedDependency = {
      name: 'package-a',
      version: '1.1.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageB: ParsedDependency = {
      name: 'package-b',
      version: '2.0.0',
      dependencies: [packageAAlt],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const lockfile: ParsedLockFile = {
      type: 'npm',
      packages: [packageA, packageAAlt, packageB],
      root: {
        name: 'root-package',
        version: '1.0.0',
        dependencies: [packageA, packageB],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    scanForDuplicates(
      messages,
      threshold,
      dependencyMap,
      lockfilePath,
      lockfile
    );

    expect(messages).toHaveLength(0);
  });

  it('should truncate long parent paths in the report', () => {
    const messages: string[] = [];
    const threshold = 1;
    const dependencyMap = new Map<string, Set<string>>([
      ['package-a', new Set(['1.0.0', '1.1.0'])]
    ]);
    const lockfilePath = 'package-lock.json';
    const longPath: ParsedDependency[] = [];
    for (let i = 0; i < 20; i++) {
      longPath.push({
        name: `package-${i}`,
        version: '1.0.0',
        dependencies: [],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      });
    }
    const packageA: ParsedDependency = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageAAlt: ParsedDependency = {
      name: 'package-a',
      version: '1.1.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    for (let i = longPath.length - 1; i > 0; i--) {
      longPath[i - 1].dependencies.push(longPath[i]);
    }
    longPath[longPath.length - 1].dependencies.push(packageAAlt);

    const lockfile: ParsedLockFile = {
      type: 'npm',
      packages: [packageA, packageAAlt, ...longPath],
      root: {
        name: 'root-package',
        version: '1.0.0',
        dependencies: [packageA, longPath[0]],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    scanForDuplicates(
      messages,
      threshold,
      dependencyMap,
      lockfilePath,
      lockfile
    );

    expect(messages).toMatchSnapshot();
  });
});
