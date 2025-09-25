import * as core from '@actions/core';

export interface PackageMetadata {
  name: string;
  version: string;
  dist?: {
    unpackedSize?: number;
  };
  dependencies?: Record<string, string>;
}

export interface PackageIndex {
  versions: Record<string, PackageMetadata>;
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

export async function calculateTotalDependencySizeIncrease(
  newVersions: Array<{name: string; version: string}>
): Promise<{totalSize: number; packageSizes: Map<string, number>} | null> {
  let totalSize = 0;
  const processedPackages = new Set<string>();
  const packageSizes = new Map<string, number>();

  for (const dep of newVersions) {
    const packageKey = `${dep.name}@${dep.version}`;

    if (processedPackages.has(packageKey)) {
      continue;
    }

    try {
      const metadata = await fetchPackageMetadata(dep.name, dep.version);

      if (!metadata || metadata.dist?.unpackedSize === undefined) {
        return null;
      }

      totalSize += metadata.dist.unpackedSize;
      packageSizes.set(packageKey, metadata.dist.unpackedSize);
      processedPackages.add(packageKey);

      core.info(`Added ${metadata.dist.unpackedSize} bytes for ${packageKey}`);
    } catch {
      return null;
    }
  }

  return {totalSize, packageSizes};
}
