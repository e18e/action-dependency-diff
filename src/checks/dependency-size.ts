import * as core from '@actions/core';
import {calculateTotalDependencySizeIncrease} from '../npm.js';
import {formatBytes} from '../common.js';

export async function scanForDependencySize(
  messages: string[],
  threshold: number,
  newVersions: Array<{name: string; version: string}>
): Promise<void> {
  if (newVersions.length === 0) {
    return;
  }
  try {
    const sizeData = await calculateTotalDependencySizeIncrease(newVersions);

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
