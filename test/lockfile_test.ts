import type {ParsedLockFile} from 'lockparse';
import {describe, it, expect} from 'vitest';
import {
  computeDependencyVersions,
  diffDependencySets
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
    const result = computeDependencyVersions(lockFile);
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
    const result = computeDependencyVersions(lockFile);
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
    const result = computeDependencyVersions(lockFile);
    expect(result.size).toBe(1);
    expect(result.get('foo')).toEqual(new Set(['1.0.0']));
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
