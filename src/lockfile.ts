import {type ParsedLockFile, traverse, type VisitorFn} from 'lockparse';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

export type VersionsSet = Map<string, Set<string>>;

export const supportedLockfiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock'
] as const;

export function computeDependencyVersions(
  lockFile: ParsedLockFile,
  includeDevDeps: boolean
): VersionsSet {
  const result: VersionsSet = new Map();

  if (!includeDevDeps) {
    const visitorFn: VisitorFn = (node) => {
      if (!node.name || !node.version) return;
      addVersion(result, node.name, node.version);
    };
    traverse(lockFile.root, {
      dependency: visitorFn,
      optionalDependency: visitorFn,
      peerDependency: visitorFn
    });
  } else {
    for (const pkg of lockFile.packages) {
      if (!pkg.name || !pkg.version) continue;
      addVersion(result, pkg.name, pkg.version);
    }
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
