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
import {fetchPackageMetadata} from '../src/npm.js';

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
