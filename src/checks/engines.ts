import * as core from '@actions/core';
import {normalizeRange, isRangeSubset} from 'verkit';
import {getNodeEnginesForPackageVersions} from '../npm.js';

export async function scanForEngineChanges(
  messages: string[],
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): Promise<void> {
  const engineRows: string[] = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);
    if (!baseVersionSet || currentVersionSet.isSubsetOf(baseVersionSet)) {
      continue;
    }

    try {
      const baseEngines = await getNodeEnginesForPackageVersions(
        packageName,
        baseVersionSet
      );
      const currentEngines = await getNodeEnginesForPackageVersions(
        packageName,
        currentVersionSet
      );

      for (const [version, currentRange] of currentEngines) {
        if (baseVersionSet.has(version) || !currentRange) {
          continue;
        }

        const normalizedCurrentRange = normalizeRange(currentRange);
        if (!normalizedCurrentRange) {
          continue;
        }

        const tighterThan = Array.from(baseEngines)
          .filter(([baseVersion]) => baseVersionSet.has(baseVersion))
          .map(([, baseRange]) => baseRange ?? '*')
          .find((baseRange) => {
            const normalizedBaseRange = normalizeRange(baseRange);
            return (
              normalizedBaseRange !== null &&
              isRangeSubset(normalizedCurrentRange, normalizedBaseRange) &&
              !isRangeSubset(normalizedBaseRange, normalizedCurrentRange)
            );
          });

        if (tighterThan !== undefined) {
          engineRows.push(
            `| ${packageName}@${version} | ${tighterThan} | ${currentRange} |`
          );
        }
      }
    } catch (err) {
      core.info(`Failed to check Node.js engine for ${packageName}: ${err}`);
    }
  }

  if (engineRows.length > 0) {
    messages.push(
      `## ⚠️ Node.js Engine Changes

| 📦 Package | Previous Node.js Engine | New Node.js Engine |
| --- | --- | --- |
${engineRows.join('\n')}`
    );
  }
}
