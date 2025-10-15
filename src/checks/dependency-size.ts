import * as core from '@actions/core';
import {type ParsedLockFile, traverse} from 'lockparse';
import {
  calculateTotalDependencySizeIncrease,
  fetchPackageMetadata,
  isSupportedArchitecture
} from '../npm.js';
import {formatBytes} from '../common.js';

export async function scanForDependencySize(
  messages: string[],
  threshold: number,
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>,
  currentLockFile: ParsedLockFile
): Promise<void> {
  const newVersions: Array<{
    name: string;
    version: string;
    isNewPackage: boolean;
  }> = [];
  const removedVersions: Array<{
    name: string;
    version: string;
  }> = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);

    for (const version of currentVersionSet) {
      if (!baseVersionSet || !baseVersionSet.has(version)) {
        newVersions.push({
          name: packageName,
          version: version,
          isNewPackage: !baseVersionSet
        });
      }
    }
  }

  for (const [packageName, baseVersionSet] of baseDeps) {
    const currentVersionSet = currentDeps.get(packageName);

    for (const version of baseVersionSet) {
      if (!currentVersionSet || !currentVersionSet.has(version)) {
        removedVersions.push({
          name: packageName,
          version: version
        });
      }
    }
  }

  if (newVersions.length > 0) {
    const allOptionalVersions = new Map<string, Set<string>>();

    for (const pkg of currentLockFile.packages) {
      traverse(pkg, {
        optionalDependency: (node) => {
          const entry = allOptionalVersions.get(node.name) ?? new Set<string>();
          entry.add(node.version);
          allOptionalVersions.set(node.name, entry);
        }
      });
    }

    for (const [pkg, versions] of allOptionalVersions) {
      for (const version of versions) {
        const pkgMeta = await fetchPackageMetadata(pkg, version);
        if (
          pkgMeta &&
          !isSupportedArchitecture(pkgMeta, 'linux', 'x64', 'glibc')
        ) {
          const entry = newVersions.findIndex(
            (v) => v.name === pkg && v.version === version
          );
          if (entry !== -1) {
            newVersions.splice(entry, 1);
          }
        }
      }
    }
  }

  core.info(`Found ${newVersions.length} new package versions`);
  core.info(`Found ${removedVersions.length} removed package versions.`);

  if (newVersions.length === 0 && removedVersions.length === 0) {
    return;
  }

  try {
    const sizeData = await calculateTotalDependencySizeIncrease(
      newVersions,
      removedVersions
    );

    core.info(
      `Total dependency size increase: ${
        sizeData ? formatBytes(sizeData.totalSize) : 'unknown'
      }`
    );

    const shouldShow =
      threshold === -1 ||
      (sizeData !== null && sizeData.totalSize >= threshold);

    if (shouldShow && sizeData !== null) {
      const packageRows = Array.from(sizeData.packageSizes.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([pkg, size]) => `| ${pkg} | ${formatBytes(size)} |`)
        .join('\n');

      let alert = '';
      if (threshold !== -1 && sizeData.totalSize >= threshold) {
        alert = `> [!WARNING]\n> This PR adds ${formatBytes(sizeData.totalSize)} of new dependencies, which exceeds the threshold of ${formatBytes(threshold)}.\n\n`;
      } else if (sizeData.totalSize < 0) {
        alert = `> [!NOTE]\n> :tada: This PR removes ${formatBytes(Math.abs(sizeData.totalSize))} of dependencies.\n\n`;
      }

      messages.push(
        `## 📊 Dependency Size Changes

${alert}| 📦 Package | 📏 Size |
| --- | --- |
${packageRows}`
      );
    }
  } catch (err) {
    core.info(`Failed to calculate total dependency size increase: ${err}`);
  }
}
