import * as fs from 'node:fs/promises';
import * as path from 'path';
import * as core from '@actions/core';

export interface PackInfo {
  name: string;
  path: string;
  size: number;
}

export interface PackSizeComparison {
  basePacks: PackInfo[];
  sourcePacks: PackInfo[];
  packChanges: Array<{
    name: string;
    baseSize: number | null;
    sourceSize: number | null;
    sizeChange: number;
    exceedsThreshold: boolean;
  }>;
}

export async function getPacksFromPattern(
  pattern: string
): Promise<PackInfo[]> {
  try {
    const packs: PackInfo[] = [];

    for await (const filePath of fs.glob(pattern)) {
      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);

      packs.push({
        name,
        path: filePath,
        size: stats.size
      });
    }

    return packs.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    core.info(`Failed to get packs from pattern "${pattern}": ${err}`);
    return [];
  }
}

export function comparePackSizes(
  basePacks: PackInfo[],
  sourcePacks: PackInfo[],
  threshold: number
): PackSizeComparison {
  const basePacksMap = new Map(basePacks.map((pack) => [pack.name, pack]));
  const sourcePacksMap = new Map(sourcePacks.map((pack) => [pack.name, pack]));

  const allPackNames = new Set([
    ...basePacks.map((p) => p.name),
    ...sourcePacks.map((p) => p.name)
  ]);

  const packChanges: Array<{
    name: string;
    baseSize: number | null;
    sourceSize: number | null;
    sizeChange: number;
    exceedsThreshold: boolean;
  }> = [];

  for (const packName of allPackNames) {
    const basePack = basePacksMap.get(packName);
    const sourcePack = sourcePacksMap.get(packName);

    const baseSize = basePack?.size ?? null;
    const sourceSize = sourcePack?.size ?? null;

    const sizeChange = (sourceSize ?? 0) - (baseSize ?? 0);
    const exceedsThreshold = sizeChange >= threshold;

    packChanges.push({
      name: packName,
      baseSize,
      sourceSize,
      sizeChange,
      exceedsThreshold
    });
  }

  return {
    basePacks,
    sourcePacks,
    packChanges: packChanges.sort((a, b) => b.sizeChange - a.sizeChange)
  };
}
