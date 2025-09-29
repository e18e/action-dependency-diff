import type {ModuleReplacement} from 'module-replacements';
import nativeManifest from 'module-replacements/manifests/native.json' with {type: 'json'};
import microUtilsManifest from 'module-replacements/manifests/micro-utilities.json' with {type: 'json'};
import preferredManifest from 'module-replacements/manifests/preferred.json' with {type: 'json'};

const allReplacements = [
  ...nativeManifest.moduleReplacements,
  ...microUtilsManifest.moduleReplacements,
  ...preferredManifest.moduleReplacements
] as ModuleReplacement[];

export function scanForReplacements(
  messages: string[],
  baseDependencies: Map<string, string>,
  currentDependencies: Map<string, string>
): void {
  const replacementMessages: string[] = [];

  for (const [name] of currentDependencies) {
    if (!baseDependencies.has(name)) {
      const replacement = allReplacements.find(
        (modReplacement) => modReplacement.moduleName === name
      );

      if (replacement) {
        switch (replacement.type) {
          case 'none':
            replacementMessages.push(
              `| ${name} | This package is no longer necessary |`
            );
            break;
          case 'native': {
            const mdnUrl = replacement.mdnPath
              ? `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/${replacement.mdnPath}`
              : '';
            const nativeReplacement = mdnUrl
              ? `[${replacement.replacement}](${mdnUrl})`
              : replacement.replacement;
            replacementMessages.push(`| ${name} | Use ${nativeReplacement} |`);
            break;
          }
          case 'simple':
            replacementMessages.push(
              `| ${name} | ${replacement.replacement} |`
            );
            break;
          case 'documented': {
            const docUrl = `https://github.com/es-tooling/module-replacements/blob/main/docs/modules/${replacement.docPath}.md`;
            replacementMessages.push(
              `| ${name} | [See documentation](${docUrl}) |`
            );
            break;
          }
        }
      }
    }
  }

  if (replacementMessages.length > 0) {
    messages.push(
      `## ⚠️ Recommended Package Replacements

The following new packages or versions have community recommended replacements:

| 📦 Package | 💡 Recommendation |
| --- | --- |
${replacementMessages.join('\n')}

> [!NOTE]
> These recommendations have been defined by the [e18e](https://e18e.dev) community.
> They may not always be a straightforward migration, so please review carefully
> and use the exclusion feature if you want to ignore any of them in future.
`
    );
  }
}
