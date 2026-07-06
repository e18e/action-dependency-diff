import {all as allReplacements, resolveDocUrl} from 'module-replacements';

export function scanForReplacements(
  messages: string[],
  baseDependencies: Map<string, string>,
  currentDependencies: Map<string, string>
): void {
  const replacementMessages: string[] = [];

  for (const [name] of currentDependencies) {
    if (!baseDependencies.has(name)) {
      const mapping = Object.values(allReplacements.mappings).find(
        (modReplacement) =>
          modReplacement.moduleName === name && modReplacement.type === 'module'
      );

      if (!mapping) {
        continue;
      }

      const replacementKey = mapping.replacements[0];
      const replacement = allReplacements.replacements[replacementKey];

      if (!replacement) {
        continue;
      }

      switch (replacement.type) {
        case 'removal':
          replacementMessages.push(`| ${name} | ${replacement.description} |`);
          break;
        case 'native': {
          const url = resolveDocUrl(mapping.url ?? replacement.url);
          const nativeReplacement = url
            ? `[${replacement.id}](${url})`
            : replacement.id;
          replacementMessages.push(`| ${name} | Use ${nativeReplacement} |`);
          break;
        }
        case 'simple':
          replacementMessages.push(`| ${name} | ${replacement.description} |`);
          break;
        case 'documented': {
          const url = resolveDocUrl(mapping.url ?? replacement.url);
          const documentedReplacement = url
            ? `[${replacement.replacementModule}](${url})`
            : replacement.replacementModule;
          replacementMessages.push(
            `| ${name} | Use ${documentedReplacement} |`
          );
          break;
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
