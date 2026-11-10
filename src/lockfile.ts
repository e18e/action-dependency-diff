/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type {ParsedDependency, ParsedLockFile} from 'lockparse';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {matchesAnyPattern} from './common.js';

export type VersionsSet = Map<string, Set<string>>;

export const supportedLockfiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock'
] as const;

export interface ComputeDependencyOptions {
  excludeDev?: boolean;
  excludeDependencies?: string[];
}

function hasRootChildren(root: ParsedDependency): boolean {
  if (!root) return false;
  return (
    (root.dependencies?.length ?? 0) > 0 ||
    (root.devDependencies?.length ?? 0) > 0 ||
    (root.optionalDependencies?.length ?? 0) > 0
  );
}

export function computeDependencyVersions(
  lockFile: ParsedLockFile,
  options?: ComputeDependencyOptions
): VersionsSet {
  const result: VersionsSet = new Map();
  const excludeDev = options?.excludeDev ?? false;
  const excludePatterns = options?.excludeDependencies ?? [];

  if (!excludeDev && excludePatterns.length === 0) {
    for (const pkg of lockFile.packages) {
      if (!pkg.name || !pkg.version) continue;
      addVersion(result, pkg.name, pkg.version);
    }
    return result;
  }

  if (hasRootChildren(lockFile.root)) {
    const visited = new Set<ParsedDependency>();
    const queue: ParsedDependency[] = [];

    const rootDeps = [
      ...(lockFile.root.dependencies ?? []),
      ...(lockFile.root.optionalDependencies ?? []),
      ...(excludeDev ? [] : (lockFile.root.devDependencies ?? []))
    ];

    for (const dep of rootDeps) {
      if (!dep.name || !dep.version) continue;
      if (
        excludePatterns.length > 0 &&
        matchesAnyPattern(dep.name, excludePatterns)
      ) {
        continue;
      }
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }

    while (queue.length > 0) {
      const current = queue.pop()!;
      addVersion(result, current.name, current.version);

      const children = [
        ...(current.dependencies ?? []),
        ...(current.optionalDependencies ?? [])
      ];

      for (const child of children) {
        if (!child.name || !child.version) continue;
        if (visited.has(child)) continue;
        if (
          excludePatterns.length > 0 &&
          matchesAnyPattern(child.name, excludePatterns)
        ) {
          continue;
        }
        visited.add(child);
        queue.push(child);
      }
    }

    return result;
  }

  for (const pkg of lockFile.packages) {
    if (!pkg.name || !pkg.version) continue;
    if (
      excludePatterns.length > 0 &&
      matchesAnyPattern(pkg.name, excludePatterns)
    ) {
      continue;
    }
    addVersion(result, pkg.name, pkg.version);
  }

  return result;
}

export function detectLockfile(workspacePath: string): string | undefined {
  for (const c of supportedLockfiles) {
    if (existsSync(join(workspacePath, c))) return c;
  }
  return undefined;
}

function addVersion(map: VersionsSet, name: string, version: string): void {
  let set = map.get(name);
  if (!set) {
    set = new Set();
    map.set(name, set);
  }
  set.add(version);
}

export function diffDependencySets(
  prev: VersionsSet,
  curr: VersionsSet
): Array<{name: string; previous: Set<string>; current: Set<string>}> {
  const names = new Set<string>([...prev.keys(), ...curr.keys()]);
  const changes: Array<{
    name: string;
    previous: Set<string>;
    current: Set<string>;
  }> = [];
  for (const name of names) {
    const a = prev.get(name) || new Set<string>();
    const b = curr.get(name) || new Set<string>();
    if (!setsEqual(a, b)) changes.push({name, previous: a, current: b});
  }
  return changes;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
