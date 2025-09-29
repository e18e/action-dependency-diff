function getLsCommand(
  lockfilePath: string,
  packageName: string
): string | undefined {
  if (lockfilePath.endsWith('package-lock.json')) {
    return `npm ls ${packageName}`;
  }
  if (lockfilePath.endsWith('pnpm-lock.yaml')) {
    return `pnpm why ${packageName}`;
  }
  if (lockfilePath.endsWith('yarn.lock')) {
    return `yarn why ${packageName}`;
  }
  if (lockfilePath.endsWith('bun.lock')) {
    return `bun pm ls ${packageName}`;
  }
  return undefined;
}

export function scanForDuplicates(
  messages: string[],
  threshold: number,
  dependencyMap: Map<string, Set<string>>,
  lockfilePath: string
): void {
  const duplicateRows: string[] = [];
  for (const [packageName, currentVersionSet] of dependencyMap) {
    if (currentVersionSet.size > threshold) {
      const versions = Array.from(currentVersionSet).sort();
      duplicateRows.push(
        `| ${packageName} | ${currentVersionSet.size} versions | ${versions.join(', ')} |`
      );
    }
  }

  if (duplicateRows.length > 0) {
    const exampleCommand = getLsCommand(lockfilePath, 'example-package');
    const helpMessage = exampleCommand
      ? `\n\n💡 To find out what depends on a specific package, run: \`${exampleCommand}\``
      : '';
    messages.push(
      `## ⚠️ Duplicate Dependencies (threshold: ${threshold})

| 📦 Package | 🔢 Version Count | 📋 Versions |
| --- | --- | --- |
${duplicateRows.join('\n')}${helpMessage}`
    );
  }
}
