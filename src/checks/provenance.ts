import * as core from '@actions/core';
import {getMinTrustLevel, getProvenanceForPackageVersions} from '../npm.js';

export async function scanForProvenance(
  messages: string[],
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): Promise<void> {
  const provenanceRows: string[] = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);

    if (!baseVersionSet || baseVersionSet.size === 0) {
      continue;
    }

    if (currentVersionSet.isSubsetOf(baseVersionSet)) {
      continue;
    }

    try {
      const baseProvenances = await getProvenanceForPackageVersions(
        packageName,
        baseVersionSet
      );
      const currentProvenances = await getProvenanceForPackageVersions(
        packageName,
        currentVersionSet
      );

      if (baseProvenances.size === 0 || currentProvenances.size === 0) {
        continue;
      }

      const minBaseTrust = getMinTrustLevel(baseProvenances.values());
      const minCurrentTrust = getMinTrustLevel(currentProvenances.values());

      if (minCurrentTrust.level < minBaseTrust.level) {
        provenanceRows.push(
          `| ${packageName} | ${minBaseTrust.status} | ${minCurrentTrust.status} |`
        );
      }
    } catch (err) {
      core.info(`Failed to check provenance for ${packageName}: ${err}`);
    }
  }

  if (provenanceRows.length > 0) {
    messages.push(
      `## ⚠️ Package Trust Level Decreased

> [!CAUTION]
> Decreased trust levels may indicate a higher risk of supply chain attacks. Please review these changes carefully.

| 📦 Package | 🔒 Before | 🔓 After |
| --- | --- | --- |
${provenanceRows.join('\n')}`
    );
  }
}
