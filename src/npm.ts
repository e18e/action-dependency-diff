import * as core from '@actions/core';

export interface PackageMetadata {
  name: string;
  version: string;
  dist?: {
    unpackedSize?: number;
  };
}

export async function fetchPackageMetadata(
  packageName: string,
  version: string
): Promise<PackageMetadata | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}/${version}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (err) {
    core.info(`Failed to fetch metadata for ${packageName}@${version}: ${err}`);
    return null;
  }
}
