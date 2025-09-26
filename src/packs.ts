import * as fs from 'node:fs/promises';
import * as path from 'path';
import * as core from '@actions/core';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {Buffer} from 'node:buffer';

interface TarHeader {
  name: string;
  size: number;
  type: string;
}

function parseTarHeader(buffer: Buffer, offset: number): TarHeader | null {
  if (offset + 512 > buffer.length) {
    return null;
  }

  const header = buffer.subarray(offset, offset + 512);

  if (header.every((byte) => byte === 0)) {
    return null;
  }

  const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
  const sizeStr = header
    .subarray(124, 136)
    .toString('utf8')
    .replace(/\0.*$/, '');
  const type = header.subarray(156, 157).toString('utf8');

  const size = parseInt(sizeStr.trim(), 8) || 0;

  return {name, size, type};
}

async function extractPackageNameFromTgz(
  filePath: string
): Promise<string | null> {
  try {
    const stream = createReadStream(filePath);
    const gunzip = createGunzip();

    let buffer = Buffer.alloc(0);
    let offset = 0;

    gunzip.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    await pipeline(stream, gunzip);

    while (offset < buffer.length) {
      const header = parseTarHeader(buffer, offset);
      if (!header) break;

      offset += 512;

      if (header.name === 'package/package.json' && header.type === '0') {
        const contentEnd = offset + header.size;
        if (contentEnd <= buffer.length) {
          const packageJsonContent = buffer
            .subarray(offset, contentEnd)
            .toString('utf8');
          try {
            const packageJson = JSON.parse(packageJsonContent);
            return packageJson.name ?? null;
          } catch (err) {
            core.info(`Failed to parse package.json in ${filePath}: ${err}`);
            return null;
          }
        }
        break;
      }

      const paddedSize = Math.ceil(header.size / 512) * 512;
      offset += paddedSize;
    }

    return null;
  } catch (err) {
    core.info(`Failed to extract package name from ${filePath}: ${err}`);
    return null;
  }
}

export interface PackInfo {
  name: string;
  packageName: string;
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
      if (!filePath.endsWith('.tgz') && !filePath.endsWith('.tar.gz')) {
        continue;
      }

      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);

      const packageName = await extractPackageNameFromTgz(filePath);

      if (!packageName) {
        core.info(
          `Warning: Skipping ${name} - could not extract package name from tgz file`
        );
        continue;
      }

      packs.push({
        name,
        packageName,
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
  const basePacksMap = new Map(
    basePacks.map((pack) => [pack.packageName, pack])
  );
  const sourcePacksMap = new Map(
    sourcePacks.map((pack) => [pack.packageName, pack])
  );

  const allPackNames = new Set([
    ...basePacks.map((p) => p.packageName),
    ...sourcePacks.map((p) => p.packageName)
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
