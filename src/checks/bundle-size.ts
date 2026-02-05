import {formatBytes} from '../common.js';
import {comparePackSizes, type PackInfo} from '../packs.js';

export async function scanForBundleSize(
  messages: string[],
  basePacks: PackInfo[],
  sourcePacks: PackInfo[],
  threshold: number
): Promise<void> {
  if (basePacks.length === 0 && sourcePacks.length === 0) {
    return;
  }
  const comparison = comparePackSizes(basePacks, sourcePacks, threshold);
  const packWarnings = comparison.packChanges.filter(
    (change) => change.exceedsThreshold && change.sizeChange > 0
  );

  if (packWarnings.length > 0) {
    const packRows = packWarnings
      .map((change) => {
        const baseSize = change.baseSize ? formatBytes(change.baseSize) : 'New';
        const sourceSize = change.sourceSize
          ? formatBytes(change.sourceSize)
          : 'Removed';
        const sizeChange = formatBytes(change.sizeChange);
        return `| ${change.name} | ${baseSize} | ${sourceSize} | ${sizeChange} |`;
      })
      .join('\n');

    messages.push(
      `## ⚠️ Package Size Increase

These packages exceed the size increase threshold of ${formatBytes(threshold)}:

| 📦 Package | 📏 Base Size | 📏 Source Size | 📈 Size Change |
| --- | --- | --- | --- |
${packRows}`
    );
  }
}
