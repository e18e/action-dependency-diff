import type {PackageJson} from 'pkg-types';
import {
  describe,
  it,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
  expect
} from 'vitest';
import {
  fetchPackageMetadata,
  metaCache,
  getProvenanceForPackageVersions,
  isSupportedArchitecture,
  getMinTrustLevel,
  getDependenciesFromPackageJson,
  type PackageMetadata,
  calculateTotalDependencySizeIncrease
} from '../src/npm.js';
import {coreLogs, clearCoreLogs} from './util.js';
import {TrustStatus} from 'packumeta';

describe('fetchPackageMetadata', () => {
  let fetchMock: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.clearAllMocks();
    metaCache.clear();
    clearCoreLogs();
  });

  it('should return null if request fails', async () => {
    const response = new Response(null, {status: 404});
    fetchMock.mockResolvedValue(response);
    const result = await fetchPackageMetadata('nonexistent-package', '1.0.0');
    expect(result).toBeNull();
  });

  it('should return package metadata for valid package and version', async () => {
    const mockMetadata = {
      name: 'some-package',
      version: '1.0.0'
    };
    const response = new Response(JSON.stringify(mockMetadata), {status: 200});
    fetchMock.mockResolvedValue(response);
    const result = await fetchPackageMetadata('some-package', '1.0.0');
    expect(result).toEqual(mockMetadata);
  });

  it('should return null if fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await fetchPackageMetadata('some-package', '1.0.0');
    expect(result).toBeNull();
    expect(coreLogs).toEqual({
      info: [
        'Failed to fetch metadata for some-package@1.0.0: Error: Network error'
      ],
      warning: [],
      debug: [],
      error: []
    });
  });
});

const wrapMockMetadataResponse = (meta: unknown) =>
  new Response(JSON.stringify(meta), {status: 200});

describe('calculateTotalDependencySizeIncrease', () => {
  let fetchMock: MockInstance<typeof globalThis.fetch>;
  let responseMap: Map<string, Response>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    responseMap = new Map<string, Response>();
    fetchMock.mockImplementation((url) => {
      if (typeof url !== 'string') {
        return Promise.resolve(new Response(null, {status: 404}));
      }
      return Promise.resolve(
        responseMap.get(url) ?? new Response(null, {status: 404})
      );
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.clearAllMocks();
    clearCoreLogs();
  });

  it('returns 0 for empty version list', async () => {
    const output = await calculateTotalDependencySizeIncrease([], []);
    expect(output?.totalSize).toEqual(0);
    expect(output?.packageSizes).toEqual(new Map());
  });

  it('sums sizes of new-old versions correctly', async () => {
    responseMap.set(
      'https://registry.npmjs.org/package-a/1.0.0',
      wrapMockMetadataResponse({
        name: 'package-a',
        version: '1.0.0',
        dist: {
          unpackedSize: 1500
        }
      })
    );
    responseMap.set(
      'https://registry.npmjs.org/package-b/2.0.0',
      wrapMockMetadataResponse({
        name: 'package-b',
        version: '2.0.0',
        dist: {
          unpackedSize: 2500
        }
      })
    );

    const newVersions = [{name: 'package-a', version: '1.0.0'}];
    const removedVersions = [{name: 'package-b', version: '2.0.0'}];
    const output = await calculateTotalDependencySizeIncrease(
      newVersions,
      removedVersions
    );
    expect(output?.totalSize).toEqual(-1000);
    expect(output?.packageSizes).toEqual(
      new Map([
        ['package-a@1.0.0', 1500],
        ['package-b@2.0.0', -2500]
      ])
    );
  });

  it('handles missing unpackedSize gracefully', async () => {
    responseMap.set(
      'https://registry.npmjs.org/package-a/1.0.0',
      wrapMockMetadataResponse({
        name: 'package-a',
        version: '1.0.0',
        dist: {
          unpackedSize: 1500
        }
      })
    );
    responseMap.set(
      'https://registry.npmjs.org/package-c/1.0.0',
      wrapMockMetadataResponse({
        name: 'package-c',
        version: '1.0.0'
        // No dist.unpackedSize
      })
    );

    const newVersions = [
      {name: 'package-a', version: '1.0.0'},
      {name: 'package-c', version: '1.0.0'}
    ];
    const output = await calculateTotalDependencySizeIncrease(newVersions, []);
    expect(output?.totalSize).toEqual(1500);
    expect(output?.packageSizes).toEqual(
      new Map([
        ['package-a@1.0.0', 1500],
        ['package-c@1.0.0', null]
      ])
    );
    expect(coreLogs).toEqual({
      info: [
        'Added 1500 bytes for package-a@1.0.0',
        'No unpacked size info for package-c@1.0.0, skipping'
      ],
      warning: [],
      debug: [],
      error: []
    });
  });
});

describe('getProvenanceForPackageVersions', () => {
  let fetchMock: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.clearAllMocks();
    metaCache.clear();
  });

  it('fetches provenance statuses for multiple versions', async () => {
    const mockMetadatas: Record<string, PackageMetadata> = {
      '1.0.0': {
        name: 'some-package',
        version: '1.0.0',
        _npmUser: {
          name: 'alice',
          email: 'alice@example.com'
        },
        dist: {
          attestations: {
            url: 'https://example.com/attestation-1.0.0',
            provenance: {}
          }
        }
      },
      '2.0.0': {
        name: 'some-package',
        version: '2.0.0',
        _npmUser: {
          name: 'bob',
          email: 'bob@example.com'
        }
      },
      '3.0.0': {
        name: 'some-package',
        version: '3.0.0',
        _npmUser: {
          name: 'jg',
          email: 'jg@example.com',
          trustedPublisher: {}
        },
        dist: {
          attestations: {
            url: 'https://example.com/attestation-1.0.0',
            provenance: {}
          }
        }
      }
    };

    fetchMock.mockImplementation((url) => {
      if (url === 'https://registry.npmjs.org/some-package/1.0.0') {
        return Promise.resolve(
          new Response(JSON.stringify(mockMetadatas['1.0.0']), {status: 200})
        );
      } else if (url === 'https://registry.npmjs.org/some-package/2.0.0') {
        return Promise.resolve(
          new Response(JSON.stringify(mockMetadatas['2.0.0']), {status: 200})
        );
      } else if (url === 'https://registry.npmjs.org/some-package/3.0.0') {
        return Promise.resolve(
          new Response(JSON.stringify(mockMetadatas['3.0.0']), {status: 200})
        );
      }
      throw new Error('Unexpected URL');
    });

    const versions = new Set(['1.0.0', '2.0.0', '3.0.0']);
    const result = await getProvenanceForPackageVersions(
      'some-package',
      versions
    );

    expect(result.get('1.0.0')).toEqual({
      provenance: true,
      trustedPublisher: false,
      stagedPublish: false
    });
    expect(result.get('2.0.0')).toEqual({
      provenance: false,
      trustedPublisher: false,
      stagedPublish: false
    });
    expect(result.get('3.0.0')).toEqual({
      provenance: true,
      trustedPublisher: true,
      stagedPublish: false
    });
  });
});

describe('getMinTrustLevel', () => {
  it('returns the minimum trust level and corresponding status', () => {
    const statuses: TrustStatus[] = [
      {provenance: true, trustedPublisher: true, stagedPublish: false},
      {provenance: true, trustedPublisher: false, stagedPublish: false},
      {provenance: false, trustedPublisher: false, stagedPublish: false},
      {provenance: true, trustedPublisher: false, stagedPublish: false}
    ];
    const result = getMinTrustLevel(statuses);
    expect(result).toEqual({
      level: 0,
      status: {
        provenance: false,
        trustedPublisher: false,
        stagedPublish: false
      }
    });
  });

  it('returns level 0 and none for empty input', () => {
    const statuses: TrustStatus[] = [];
    const result = getMinTrustLevel(statuses);
    expect(result).toEqual({
      level: 0,
      status: {
        provenance: false,
        trustedPublisher: false,
        stagedPublish: false
      }
    });
  });
});

describe('getDependenciesFromPackageJson', () => {
  it('extracts valid dependencies from package.json', () => {
    const packageJson = {
      dependencies: {
        'valid-package': '^1.0.0',
        'another-package': '~2.3.4'
      },
      devDependencies: {
        'dev-package': '3.0.0'
      }
    };
    const deps = getDependenciesFromPackageJson(packageJson, ['prod']);
    const devDeps = getDependenciesFromPackageJson(packageJson, ['dev']);
    const allDeps = getDependenciesFromPackageJson(packageJson, [
      'prod',
      'dev'
    ]);
    expect(deps).toEqual(
      new Map([
        ['valid-package', '^1.0.0'],
        ['another-package', '~2.3.4']
      ])
    );
    expect(devDeps).toEqual(new Map([['dev-package', '3.0.0']]));
    expect(allDeps).toEqual(
      new Map([
        ['valid-package', '^1.0.0'],
        ['another-package', '~2.3.4'],
        ['dev-package', '3.0.0']
      ])
    );
  });

  it('ignores invalid dependencies', () => {
    const packageJson = {
      dependencies: {
        'valid-package': '^1.0.0',
        'invalid-package': 12345,
        'another-invalid': null
      },
      devDependencies: {
        'dev-package': '3.0.0',
        'bad-dev-package': {}
      }
    };
    const deps = getDependenciesFromPackageJson(packageJson as never, [
      'prod',
      'dev'
    ]);
    expect(deps).toEqual(
      new Map([
        ['valid-package', '^1.0.0'],
        ['dev-package', '3.0.0']
      ])
    );
  });
});

describe('isSupportedArchitecture', () => {
  it('returns true if no os, cpu, or libc fields are present', () => {
    const pkg: PackageJson = {
      name: 'some-package'
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
  });

  it('returns true if os matches, cpu/libc empty', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      os: ['linux', 'darwin']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'darwin', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'win32', 'x64', 'glibc')).toBe(false);
  });

  it('returns true if cpu matches, os/libc empty', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      cpu: ['x64', 'arm64']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'arm64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'ia32', 'glibc')).toBe(false);
  });

  it('returns true if libc matches, os/cpu empty', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      libc: ['glibc', 'musl']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'musl')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'uclibc')).toBe(false);
  });

  it('returns true if all match', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      os: ['linux', 'darwin'],
      cpu: ['x64', 'arm64'],
      libc: ['glibc', 'musl']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'darwin', 'arm64', 'musl')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'ia32', 'glibc')).toBe(false);
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'uclibc')).toBe(false);
    expect(isSupportedArchitecture(pkg, 'win32', 'x64', 'glibc')).toBe(false);
  });

  it('returns true if os is empty array', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      os: [],
      cpu: ['x64'],
      libc: ['glibc']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'darwin', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'win32', 'x64', 'glibc')).toBe(true);
  });

  it('returns true if cpu is empty array', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      os: ['linux'],
      cpu: [],
      libc: ['glibc']
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'arm64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'ia32', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'darwin', 'x64', 'glibc')).toBe(false);
  });

  it('returns true if libc is empty array', () => {
    const pkg: PackageJson = {
      name: 'some-package',
      os: ['linux'],
      cpu: ['x64'],
      libc: []
    };
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'glibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'musl')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'linux', 'x64', 'uclibc')).toBe(true);
    expect(isSupportedArchitecture(pkg, 'darwin', 'x64', 'glibc')).toBe(false);
  });
});
