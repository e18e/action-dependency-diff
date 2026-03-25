import {formatBytes} from '../common.js';
import {comparePackSizes, type PackInfo} from '../packs.js';

function formatBytesSigned(bytes: number): string {
  return `${bytes > 0 ? '+' : ''}${formatBytes(bytes)}`;
}

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

  if (threshold === -1) {
    const changedPacks = comparison.packChanges.filter(
      (change) => change.exceedsThreshold
    );

    if (changedPacks.length === 0) {
      messages.push(`## 📦 Package Bundle Size\n\nNo bundle size changes.`);
      return;
    }

    if (changedPacks.length > 0) {
      const hasDecreases = changedPacks.some((c) => c.sizeChange < 0);
      const hasIncreases = changedPacks.some((c) => c.sizeChange > 0);

      const heading =
        hasDecreases && hasIncreases
          ? '## 📦 Package Bundle Size Changes'
          : hasDecreases
            ? '## 🎉 Package Size Decrease'
            : '## ⚠️ Package Size Increase';

      const packRows = changedPacks
        .map((change) => {
          const baseSize = change.baseSize
            ? formatBytes(change.baseSize)
            : 'New';
          const sourceSize = change.sourceSize
            ? formatBytes(change.sourceSize)
            : 'Removed';
          const sizeChange = formatBytesSigned(change.sizeChange);
          return `| ${change.name} | ${baseSize} | ${sourceSize} | ${sizeChange} |`;
        })
        .join('\n');

      messages.push(
        `${heading}

| 📦 Package | 📏 Base Size | 📏 Source Size | 📊 Size Change |
| --- | --- | --- | --- |
${packRows}`
      );
    }

    return;
  }

  const totalSizeChange = comparison.packChanges
    .filter((change) => change.sizeChange > 0)
    .reduce((sum, change) => sum + change.sizeChange, 0);

  if (totalSizeChange < threshold) {
    return;
  }

  const packWarnings = comparison.packChanges.filter(
    (change) => change.sizeChange > 0
  );

  if (packWarnings.length > 0) {
    const packRows = packWarnings
      .map((change) => {
        const baseSize = change.baseSize ? formatBytes(change.baseSize) : 'New';
        const sourceSize = change.sourceSize
          ? formatBytes(change.sourceSize)
          : 'Removed';
        const sizeChange = formatBytesSigned(change.sizeChange);
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
