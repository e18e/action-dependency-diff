import * as core from '@actions/core';
import {getLicensesForPackageVersions} from '../npm.js';

export async function scanForLicenses(
  messages: string[],
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): Promise<void> {
  const licenseRows: string[] = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);

    if (!baseVersionSet || baseVersionSet.size === 0) {
      continue;
    }

    if (currentVersionSet.isSubsetOf(baseVersionSet)) {
      continue;
    }

    try {
      const baseLicensesMap = await getLicensesForPackageVersions(
        packageName,
        baseVersionSet
      );
      const currentLicensesMap = await getLicensesForPackageVersions(
        packageName,
        currentVersionSet
      );

      if (baseLicensesMap.size === 0 || currentLicensesMap.size === 0) {
        continue;
      }

      const baseLicenses = new Set<string>();
      const baseLicensesLower = new Set<string>();
      for (const license of baseLicensesMap.values()) {
        if (license) {
          baseLicenses.add(license);
          baseLicensesLower.add(license.toLowerCase());
        }
      }

      if (baseLicenses.size === 0) {
        continue;
      }

      const previousLicenseText = Array.from(baseLicenses).join(', ');

      for (const [version, license] of currentLicensesMap) {
        if (baseVersionSet.has(version)) {
          continue;
        }
        const currentLicense = license ?? 'Unknown';
        if (!baseLicensesLower.has(currentLicense.toLowerCase())) {
          licenseRows.push(
            `| ${packageName}@${version} | ${previousLicenseText} | ${currentLicense} |`
          );
        }
      }
    } catch (err) {
      core.info(`Failed to check license for ${packageName}: ${err}`);
    }
  }

  if (licenseRows.length > 0) {
    messages.push(
      `## ⚠️ License Changes

| 📦 Package | 📜 Previous License | 📜 New License |
| --- | --- | --- |
${licenseRows.join('\n')}`
    );
  }
}
