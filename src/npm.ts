import * as core from '@actions/core';
import type {PackageJson} from 'pkg-types';

export interface PackageMetadata {
  name: string;
  version: string;
  os?: string[];
  cpu?: string[];
  dist?: {
    unpackedSize?: number;
    attestations?: {
      url: string;
      provenance?: unknown;
    };
  };
  _npmUser: {
    name: string;
    email: string;
    trustedPublisher?: unknown;
  };
  dependencies?: Record<string, string>;
}

export interface PackageIndex {
  versions: Record<string, PackageMetadata>;
}

export type ProvenanceStatus =
  | 'trusted-with-provenance'
  | 'provenance'
  | 'none';

export function getProvenance(meta: PackageMetadata): ProvenanceStatus {
  if (meta._npmUser?.trustedPublisher) {
    return 'trusted-with-provenance';
  }
  if (meta.dist?.attestations?.provenance) {
    return 'provenance';
  }
  return 'none';
}

export function getTrustLevel(status: ProvenanceStatus): number {
  switch (status) {
    case 'trusted-with-provenance':
      return 2;
    case 'provenance':
      return 1;
    case 'none':
      return 0;
    default:
      return 0;
  }
}

export async function getProvenanceForPackageVersions(
  packageName: string,
  versions: Set<string>
): Promise<Map<string, ProvenanceStatus>> {
  const result = new Map<string, ProvenanceStatus>();
  for (const version of versions) {
    const metadata = await fetchPackageMetadata(packageName, version);
    if (metadata) {
      result.set(version, getProvenance(metadata));
    }
  }
  return result;
}

export interface MinTrustLevelResult {
  level: number;
  status: ProvenanceStatus;
}

export function getMinTrustLevel(
  statuses: Iterable<ProvenanceStatus>
): MinTrustLevelResult {
  let result: MinTrustLevelResult | null = null;
  for (const status of statuses) {
    const level = getTrustLevel(status);
    if (result === null || level < result.level) {
      result = {level, status};
    }
  }
  if (!result) {
    return {level: 0, status: 'none'};
  }
  return result;
}

type MaybePromise<T> = T | Promise<T>;

export const metaCache = new Map<
  string,
  MaybePromise<PackageMetadata | null>
>();

async function fetchPackageMetadataImmediate(
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

export async function fetchPackageMetadata(
  packageName: string,
  version: string
): Promise<PackageMetadata | null> {
  const cacheKey = `${packageName}@${version}`;
  const cached = metaCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const meta = fetchPackageMetadataImmediate(packageName, version);
  metaCache.set(cacheKey, meta);
  const result = await meta;
  metaCache.set(cacheKey, result);
  return result;
}

export async function calculateTotalDependencySizeIncrease(
  newVersions: Array<{name: string; version: string}>,
  removedVersions: Array<{name: string; version: string}>
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

  for (const dep of removedVersions) {
    const packageKey = `${dep.name}@${dep.version}`;

    if (processedPackages.has(packageKey)) {
      continue;
    }

    try {
      const metadata = await fetchPackageMetadata(dep.name, dep.version);

      if (!metadata || metadata.dist?.unpackedSize === undefined) {
        return null;
      }

      totalSize -= metadata.dist.unpackedSize;
      packageSizes.set(packageKey, -metadata.dist.unpackedSize);
      processedPackages.add(packageKey);

      core.info(
        `Subtracted ${metadata.dist.unpackedSize} bytes for ${packageKey}`
      );
    } catch {
      return null;
    }
  }

  return {totalSize, packageSizes};
}

export type DependencyType = 'prod' | 'dev' | 'optional' | 'peer';

const dependencyTypeMap = {
  prod: 'dependencies',
  dev: 'devDependencies',
  optional: 'optionalDependencies',
  peer: 'peerDependencies'
} satisfies Record<DependencyType, keyof PackageJson>;

export function getDependenciesFromPackageJson(
  pkg: PackageJson,
  types: DependencyType[]
): Map<string, string> {
  const result = new Map<string, string>();

  for (const type of types) {
    const value = pkg[dependencyTypeMap[type]];
    if (value === undefined) {
      continue;
    }

    for (const [name, version] of Object.entries(value)) {
      if (typeof version !== 'string') {
        continue;
      }
      result.set(name, version);
    }
  }

  return result;
}
