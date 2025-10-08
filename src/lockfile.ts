import type {ParsedLockFile} from 'lockparse';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export type VersionsSet = Map<string, Set<string>>;

export const supportedLockfiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock'
] as const;

export function computeDependencyVersions(
  lockFile: ParsedLockFile
): VersionsSet {
  const result: VersionsSet = new Map();

  for (const pkg of lockFile.packages) {
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

export function readTextFile(path: string): string {
  return readFileSync(path, 'utf8');
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
