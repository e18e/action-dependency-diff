import * as core from '@actions/core';
import {getInstallScriptsForPackageVersions} from '../npm.js';
import type {CheckResult} from './result.js';

export async function scanForInstallScripts(
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): Promise<CheckResult | undefined> {
  const installScriptRows: string[] = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);

    if (baseVersionSet && currentVersionSet.isSubsetOf(baseVersionSet)) {
      continue;
    }

    try {
      const baseScripts = new Set<string>();
      if (baseVersionSet) {
        const baseScriptsMap = await getInstallScriptsForPackageVersions(
          packageName,
          baseVersionSet
        );
        for (const scripts of baseScriptsMap.values()) {
          for (const script of scripts) {
            baseScripts.add(script);
          }
        }
      }

      const currentScriptsMap = await getInstallScriptsForPackageVersions(
        packageName,
        currentVersionSet
      );

      for (const [version, scripts] of currentScriptsMap) {
        if (baseVersionSet?.has(version)) {
          continue;
        }
        const addedScripts = scripts.filter(
          (script) => !baseScripts.has(script)
        );
        if (addedScripts.length === 0) {
          continue;
        }

        const change = baseVersionSet ? 'Upgraded' : 'New package';
        const scriptsText = addedScripts
          .map((script) => `\`${script}\``)
          .join(', ');
        installScriptRows.push(
          `| ${packageName}@${version} | ${change} | ${scriptsText} |`
        );
      }
    } catch (err) {
      core.info(`Failed to check install scripts for ${packageName}: ${err}`);
    }
  }

  if (installScriptRows.length > 0) {
    return {
      check: 'install-scripts',
      breached: true,
      message: `## ⚠️ Install Scripts Added

> [!WARNING]
> These packages run scripts during \`npm install\`. New install scripts can execute arbitrary code and increase supply chain risk. Please review them carefully.

| 📦 Package | 🔄 Change | 🔧 Added Install Scripts |
| --- | --- | --- |
${installScriptRows.join('\n')}`
    };
  }
}
