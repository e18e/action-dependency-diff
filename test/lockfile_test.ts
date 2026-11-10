import type {ParsedLockFile} from 'lockparse';
import {describe, it, expect} from 'vitest';
import {
  computeDependencyVersions,
  diffDependencySets,
  filterPackages
} from '../src/lockfile.js';

const mockLockFile: ParsedLockFile = {
  type: 'npm',
  packages: [],
  root: {
    name: 'root',
    version: '1.0.0',
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    peerDependencies: []
  }
};

describe('computeDependencyVersions', () => {
  it('should return an empty map for an empty lock file', () => {
    const lockFile: ParsedLockFile = {...mockLockFile};
    const result = computeDependencyVersions(lockFile.packages);
    expect(result.size).toBe(0);
  });

  it('should correctly compute versions for a simple lock file', () => {
    const lockFile: ParsedLockFile = {
      ...mockLockFile,
      packages: [
        {
          name: 'foo',
          version: '1.0.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: 'bar',
          version: '2.0.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: 'foo',
          version: '1.1.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        }
      ]
    };
    const result = computeDependencyVersions(lockFile.packages);
    expect(result.size).toBe(2);
    expect(result.get('foo')).toEqual(new Set(['1.0.0', '1.1.0']));
    expect(result.get('bar')).toEqual(new Set(['2.0.0']));
  });

  it('should ignore packages without name or version', () => {
    const lockFile: ParsedLockFile = {
      ...mockLockFile,
      packages: [
        {
          name: 'foo',
          version: '1.0.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: '',
          version: '2.0.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: 'bar',
          version: '',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        }
      ]
    };
    const result = computeDependencyVersions(lockFile.packages);
    expect(result.size).toBe(1);
    expect(result.get('foo')).toEqual(new Set(['1.0.0']));
  });

  it('should exclude devDependencies and their exclusive transitive dependencies when excludeDev is true', () => {
    const sharedTransitive = {
      name: 'shared-pkg',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const devOnlyTransitive = {
      name: 'dev-transitive',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const prodDep = {
      name: 'prod-pkg',
      version: '1.0.0',
      dependencies: [sharedTransitive],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const devDep = {
      name: 'dev-pkg',
      version: '1.0.0',
      dependencies: [devOnlyTransitive, sharedTransitive],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };

    const lockFile: ParsedLockFile = {
      type: 'npm',
      packages: [prodDep, devDep, sharedTransitive, devOnlyTransitive],
      root: {
        name: 'root',
        version: '1.0.0',
        dependencies: [prodDep],
        devDependencies: [devDep],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    const result = computeDependencyVersions(
      filterPackages(lockFile, {excludeDev: true})
    );
    expect(result.has('prod-pkg')).toBe(true);
    expect(result.has('shared-pkg')).toBe(true);
    expect(result.has('dev-pkg')).toBe(false);
    expect(result.has('dev-transitive')).toBe(false);
  });

  it('should exclude packages matching excludeDependencies patterns and their subtrees', () => {
    const childOfIgnored = {
      name: 'secret-child',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const ignoredDep = {
      name: 'eslint-plugin-foo',
      version: '1.0.0',
      dependencies: [childOfIgnored],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const keptDep = {
      name: 'react',
      version: '18.2.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };

    const lockFile: ParsedLockFile = {
      type: 'npm',
      packages: [keptDep, ignoredDep, childOfIgnored],
      root: {
        name: 'root',
        version: '1.0.0',
        dependencies: [keptDep, ignoredDep],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    const result = computeDependencyVersions(
      filterPackages(lockFile, {
        excludeDependencies: ['eslint-*']
      })
    );
    expect(result.size).toBe(1);
    expect(result.has('react')).toBe(true);
    expect(result.has('eslint-plugin-foo')).toBe(false);
    expect(result.has('secret-child')).toBe(false);
  });

  it('should handle cyclic dependencies in the graph', () => {
    const pkgA: ParsedLockFile['packages'][number] = {
      name: 'pkg-a',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const pkgB: ParsedLockFile['packages'][number] = {
      name: 'pkg-b',
      version: '1.0.0',
      dependencies: [pkgA],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    pkgA.dependencies.push(pkgB);

    const lockFile: ParsedLockFile = {
      type: 'npm',
      packages: [pkgA, pkgB],
      root: {
        name: 'root',
        version: '1.0.0',
        dependencies: [pkgA],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    };

    const result = computeDependencyVersions(
      filterPackages(lockFile, {excludeDev: true})
    );
    expect(result.size).toBe(2);
    expect(result.get('pkg-a')).toEqual(new Set(['1.0.0']));
    expect(result.get('pkg-b')).toEqual(new Set(['1.0.0']));
  });

  it('should fall back to filtering flat packages list when root has no children', () => {
    const lockFile: ParsedLockFile = {
      ...mockLockFile,
      packages: [
        {
          name: '@types/node',
          version: '20.0.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: 'lodash.get',
          version: '4.4.2',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        },
        {
          name: 'zod',
          version: '3.22.0',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        }
      ]
    };

    const result = computeDependencyVersions(
      filterPackages(lockFile, {
        excludeDependencies: ['@types/*', 'lodash.*']
      })
    );
    expect(result.size).toBe(1);
    expect(result.has('zod')).toBe(true);
  });
});

describe('diffDependencySets', () => {
  it('should return an empty array for identical sets', () => {
    const setA = new Map<string, Set<string>>([
      ['foo', new Set(['1.0.0'])],
      ['bar', new Set(['2.0.0'])]
    ]);
    const setB = new Map<string, Set<string>>([
      ['foo', new Set(['1.0.0'])],
      ['bar', new Set(['2.0.0'])]
    ]);
    const result = diffDependencySets(setA, setB);
    expect(result.length).toBe(0);
  });

  it('should detect added dependencies', () => {
    const setA = new Map<string, Set<string>>([['foo', new Set(['1.0.0'])]]);
    const setB = new Map<string, Set<string>>([
      ['foo', new Set(['1.0.0'])],
      ['bar', new Set(['2.0.0'])]
    ]);
    const result = diffDependencySets(setA, setB);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      name: 'bar',
      previous: new Set(),
      current: new Set(['2.0.0'])
    });
  });

  it('should detect removed dependencies', () => {
    const setA = new Map<string, Set<string>>([
      ['foo', new Set(['1.0.0'])],
      ['bar', new Set(['2.0.0'])]
    ]);
    const setB = new Map<string, Set<string>>([['foo', new Set(['1.0.0'])]]);
    const result = diffDependencySets(setA, setB);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      name: 'bar',
      previous: new Set(['2.0.0']),
      current: new Set()
    });
  });
});
