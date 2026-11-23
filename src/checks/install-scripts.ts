import * as core from '@actions/core';
import {fetchPackageMetadata, getInstallScriptNames} from '../npm.js';

export async function scanForInstallScripts(
  messages: string[],
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): Promise<void> {
  const installScriptRows: string[] = [];

  for (const [packageName, currentVersionSet] of currentDeps) {
    const baseVersionSet = baseDeps.get(packageName);

    const newVersions = Array.from(currentVersionSet).filter(
      (version) => !baseVersionSet?.has(version)
    );
    if (newVersions.length === 0) {
      continue;
    }

    try {
      const baseScripts = new Set<string>();
      if (baseVersionSet) {
        for (const version of baseVersionSet) {
          const metadata = await fetchPackageMetadata(packageName, version);
          for (const script of getInstallScriptNames(metadata)) {
            baseScripts.add(script);
          }
        }
      }

      for (const version of newVersions) {
        const metadata = await fetchPackageMetadata(packageName, version);
        const addedScripts = getInstallScriptNames(metadata).filter(
          (script) => !baseScripts.has(script)
        );
        if (addedScripts.length === 0) {
          continue;
        }

        const change = baseVersionSet ? 'Upgraded' : 'New package';
        const scripts = addedScripts
          .map((script) => `\`${script}\``)
          .join(', ');
        installScriptRows.push(
          `| ${packageName}@${version} | ${change} | ${scripts} |`
        );
      }
    } catch (err) {
      core.info(`Failed to check install scripts for ${packageName}: ${err}`);
    }
  }

  if (installScriptRows.length > 0) {
    messages.push(
      `## ⚠️ Install Scripts Added

> [!WARNING]
> These packages run scripts during \`npm install\`. New install scripts can execute arbitrary code and increase supply chain risk. Please review them carefully.

| 📦 Package | 🔄 Change | 🔧 Added Install Scripts |
| --- | --- | --- |
${installScriptRows.join('\n')}`
    );
  }
}
