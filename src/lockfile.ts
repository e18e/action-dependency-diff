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
  excludeDevDependencies?: boolean;
  excludePackages?: string[];
}

function hasRootChildren(root: ParsedDependency): boolean {
  if (!root) return false;
  return (
    (root.dependencies?.length ?? 0) > 0 ||
    (root.devDependencies?.length ?? 0) > 0 ||
    (root.optionalDependencies?.length ?? 0) > 0
  );
}

export function filterPackages(
  lockFile: ParsedLockFile,
  options?: ComputeDependencyOptions
): ParsedDependency[] {
  const excludeDevDependencies = options?.excludeDevDependencies ?? false;
  const excludePatterns = options?.excludePackages ?? [];
  const isIncluded = (dep: ParsedDependency) =>
    !matchesAnyPattern(dep.name, excludePatterns);

  if (!excludeDevDependencies && excludePatterns.length === 0) {
    return lockFile.packages;
  }

  if (!hasRootChildren(lockFile.root)) {
    return lockFile.packages.filter(isIncluded);
  }

  const root = lockFile.root;
  const visited = new Set<ParsedDependency>();
  const queue: ParsedDependency[] = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const deps of [
      current.dependencies,
      current.optionalDependencies,
      current === root && !excludeDevDependencies
        ? root.devDependencies
        : undefined
    ]) {
      if (!deps) continue;
      for (const child of deps) {
        if (visited.has(child) || !isIncluded(child)) continue;
        visited.add(child);
        queue.push(child);
      }
    }
  }

  return [...visited];
}

export function computeDependencyVersions(
  packages: ParsedDependency[]
): VersionsSet {
  const result: VersionsSet = new Map();
  for (const pkg of packages) {
    if (!pkg.name || !pkg.version) continue;
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
