import {
  type ParsedLockFile,
  traverse,
  type ParsedDependency,
  type VisitorFn
} from 'lockparse';

function getLsCommand(
  lockfilePath: string,
  packageName: string
): string | undefined {
  if (lockfilePath.endsWith('package-lock.json')) {
    return `npm ls ${packageName}`;
  }
  if (lockfilePath.endsWith('pnpm-lock.yaml')) {
    return `pnpm -r why ${packageName}`;
  }
  if (lockfilePath.endsWith('yarn.lock')) {
    return `yarn why ${packageName}`;
  }
  if (lockfilePath.endsWith('bun.lock')) {
    return `bun pm ls ${packageName}`;
  }
  return undefined;
}

function computeParentPaths(
  lockfile: ParsedLockFile,
  duplicateDependencyNames: Set<string>,
  dependencyMap: Map<string, Set<string>>
): Map<string, string> {
  const parentPaths = new Map<string, string>();

  const visitorFn: VisitorFn = (node, _parent, path) => {
    if (!duplicateDependencyNames.has(node.name) || !path) {
      return;
    }
    const versionSet = dependencyMap.get(node.name);
    if (!versionSet) {
      return;
    }
    const parentPath = path
      .map((node) => `${node.name}@${node.version}`)
      .join(' -> ');
    parentPaths.set(`${node.name}@${node.version}`, parentPath);
  };
  const visitor = {
    dependency: visitorFn,
    devDependency: visitorFn,
    peerDependency: visitorFn,
    optionalDependency: visitorFn
  };
  for (const pkg of lockfile.packages) {
    visitorFn(pkg, null);
    traverse(pkg, visitor);
  }

  return parentPaths;
}

export function scanForDuplicates(
  messages: string[],
  threshold: number,
  dependencyMap: Map<string, Set<string>>,
  lockfilePath: string,
  lockfile: ParsedLockFile
): void {
  const duplicateRows: string[] = [];
  const duplicateDependencyNames = new Set<string>();

  for (const [packageName, currentVersionSet] of dependencyMap) {
    if (currentVersionSet.size > threshold) {
      duplicateDependencyNames.add(packageName);
    }
  }

  if (duplicateDependencyNames.size === 0) {
    return;
  }

  const parentPaths = computeParentPaths(
    lockfile,
    duplicateDependencyNames,
    dependencyMap
  );

  for (const name of duplicateDependencyNames) {
    const versionSet = dependencyMap.get(name);
    if (!versionSet) {
      continue;
    }
    const versions = Array.from(versionSet).sort();

    const detailsLines: string[] = [];
    for (const version of versions) {
      const pathKey = `${name}@${version}`;
      const path = parentPaths.get(pathKey);
      const pathDisplay = path || '(root)';
      detailsLines.push(`**${version}**: ${pathDisplay}`);
    }

    const detailsContent = detailsLines.join('  \n');
    const collapsibleSection = `<details><summary>${versionSet.size} version${versionSet.size > 1 ? 's' : ''}</summary>\n\n${detailsContent}\n\n</details>`;

    duplicateRows.push(`| ${name} | ${collapsibleSection} |`);
  }

  if (duplicateRows.length > 0) {
    const exampleCommand = getLsCommand(lockfilePath, 'example-package');
    const helpMessage = exampleCommand
      ? `\n\n💡 To find out what depends on a specific package, run: \`${exampleCommand}\``
      : '';
    messages.push(
      `## ⚠️ Duplicate Dependencies (threshold: ${threshold})

| 📦 Package | 📋 Versions |
| --- | --- |
${duplicateRows.join('\n')}${helpMessage}`
    );
  }
}
