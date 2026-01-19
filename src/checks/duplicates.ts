import {type ParsedLockFile, traverse, type VisitorFn} from 'lockparse';

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
): Map<string, string[]> {
  const parentPaths = new Map<string, string[]>();

  const visitorFn: VisitorFn = (node, _parent, path) => {
    if (!duplicateDependencyNames.has(node.name) || !path) {
      return;
    }
    const versionSet = dependencyMap.get(node.name);
    if (!versionSet) {
      return;
    }
    const nodeKey = `${node.name}@${node.version}`;
    if (parentPaths.has(nodeKey)) {
      return;
    }
    const parentPath = path.map((node) => `${node.name}@${node.version}`);
    parentPaths.set(nodeKey, parentPath);
  };
  const visitor = {
    dependency: visitorFn,
    devDependency: visitorFn,
    optionalDependency: visitorFn
  };

  traverse(lockfile.root, visitor);

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
      const pathArray = parentPaths.get(pathKey);
      if (pathArray && pathArray.length > 0) {
        const maxDepth = 6;
        const totalDepth = pathArray.length + 1;

        let displayPath: string[];
        if (totalDepth > maxDepth) {
          displayPath = [
            ...pathArray.slice(0, 2),
            '...',
            ...pathArray.slice(-2)
          ];
        } else {
          displayPath = pathArray;
        }

        let nestedList = `<li>**${name}@${version}**</li>`;
        for (let i = displayPath.length - 1; i >= 0; i--) {
          nestedList = `<li>${displayPath[i]}<ul>${nestedList}</ul></li>`;
        }
        detailsLines.push(`<ul>${nestedList}</ul>`);
      } else {
        detailsLines.push(`**${name}@${version}**`);
      }
    }

    const detailsContent = detailsLines.join('<br>');
    const collapsibleSection = `<details><summary>${versionSet.size} version${versionSet.size > 1 ? 's' : ''}</summary><br>${detailsContent}<br></details>`;

    duplicateRows.push(`| ${name} | ${collapsibleSection} |`);
  }

  if (duplicateRows.length > 0) {
    const exampleCommand = getLsCommand(lockfilePath, 'example-package');
    const helpMessage = exampleCommand
      ? `\n\n💡 To find out what depends on a specific package, run: \`${exampleCommand}\``
      : '';
    messages.push(
      `## ⚠️ Duplicate Dependencies (found: ${duplicateRows.length}, threshold: ${threshold})

| 📦 Package | 📋 Versions |
| --- | --- |
${duplicateRows.join('\n')}${helpMessage}`
    );
  }
}
