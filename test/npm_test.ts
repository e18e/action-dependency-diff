import * as core from '@actions/core';
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
  getProvenance,
  getTrustLevel,
  getProvenanceForPackageVersions,
  getMinTrustLevel,
  getDependenciesFromPackageJson,
  type ProvenanceStatus,
  type PackageMetadata
} from '../src/npm.js';

describe('fetchPackageMetadata', () => {
  let fetchMock: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.mock(import('@actions/core'), async (importModule) => {
      const mod = await importModule();
      return {
        ...mod,
        info: vi.fn(),
        error: vi.fn()
      };
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.clearAllMocks();
    metaCache.clear();
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
    const infoSpy = vi.mocked(core.info);
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await fetchPackageMetadata('some-package', '1.0.0');
    expect(result).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(
      'Failed to fetch metadata for some-package@1.0.0: Error: Network error'
    );
  });
});

describe('getProvenance', () => {
  it('returns trusted-with-provenance for trusted publisher', () => {
    const meta: PackageMetadata = {
      name: 'foo',
      version: '1.0.0',
      _npmUser: {
        name: 'bob',
        email: 'bob@bill.com',
        trustedPublisher: {}
      }
    };
    expect(getProvenance(meta)).toBe('trusted-with-provenance');
  });

  it('returns provenance if attestations with provenance exist', () => {
    const meta: PackageMetadata = {
      name: 'foo',
      version: '1.0.0',
      _npmUser: {
        name: 'bob',
        email: 'bob@bill.com'
      },
      dist: {
        attestations: {
          url: 'https://example.com',
          provenance: {}
        }
      }
    };
    expect(getProvenance(meta)).toBe('provenance');
  });

  it('returns none if no provenance information is available', () => {
    const meta: PackageMetadata = {
      name: 'foo',
      version: '1.0.0',
      _npmUser: {
        name: 'bob',
        email: 'bob@bill.com'
      }
    };
    expect(getProvenance(meta)).toBe('none');
  });
});

describe('getTrustLevel', () => {
  it('returns 2 for trusted-with-provenance', () => {
    expect(getTrustLevel('trusted-with-provenance')).toBe(2);
  });

  it('returns 1 for provenance', () => {
    expect(getTrustLevel('provenance')).toBe(1);
  });

  it('returns 0 for none', () => {
    expect(getTrustLevel('none')).toBe(0);
  });

  it('returns 0 for unknown status', () => {
    expect(getTrustLevel('unknown' as never)).toBe(0);
  });
});

describe('getProvenanceForPackageVersions', () => {
  let fetchMock: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.mock(import('@actions/core'), async (importModule) => {
      const mod = await importModule();
      return {
        ...mod,
        info: vi.fn(),
        error: vi.fn()
      };
    });
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

    expect(result.get('1.0.0')).toBe('provenance');
    expect(result.get('2.0.0')).toBe('none');
    expect(result.get('3.0.0')).toBe('trusted-with-provenance');
  });
});

describe('getMinTrustLevel', () => {
  it('returns the minimum trust level and corresponding status', () => {
    const statuses: ProvenanceStatus[] = [
      'trusted-with-provenance',
      'provenance',
      'none',
      'provenance'
    ];
    const result = getMinTrustLevel(statuses);
    expect(result).toEqual({level: 0, status: 'none'});
  });

  it('returns level 0 and none for empty input', () => {
    const statuses: ProvenanceStatus[] = [];
    const result = getMinTrustLevel(statuses);
    expect(result).toEqual({level: 0, status: 'none'});
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
