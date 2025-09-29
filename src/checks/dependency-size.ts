import * as core from '@actions/core';
import {calculateTotalDependencySizeIncrease} from '../npm.js';
import {formatBytes} from '../common.js';

export async function scanForDependencySize(
  messages: string[],
  threshold: number,
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
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

    if (sizeData !== null && sizeData.totalSize >= threshold) {
      const packageRows = Array.from(sizeData.packageSizes.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([pkg, size]) => `| ${pkg} | ${formatBytes(size)} |`)
        .join('\n');

      messages.push(
        `## ⚠️ Large Dependency Size Increase

This PR adds ${formatBytes(sizeData.totalSize)} of new dependencies, which exceeds the threshold of ${formatBytes(threshold)}.

| 📦 Package | 📏 Size |
| --- | --- |
${packageRows}`
      );
    }
  } catch (err) {
    core.info(`Failed to calculate total dependency size increase: ${err}`);
  }
}
