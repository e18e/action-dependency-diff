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

  const allUnchanged = comparison.packChanges.every(
    (change) => change.sizeChange === 0
  );

  if (allUnchanged) {
    messages.push(`## 📦 Package Bundle Size\n\nNo bundle size changes.`);
    return;
  }

  if (threshold === -1) {
    const decreases = comparison.packChanges.filter(
      (change) => change.exceedsThreshold && change.sizeChange < 0
    );
    const increases = comparison.packChanges.filter(
      (change) => change.exceedsThreshold && change.sizeChange > 0
    );

    if (decreases.length > 0) {
      const packRows = decreases
        .map((change) => {
          const baseSize = change.baseSize
            ? formatBytes(change.baseSize)
            : 'New';
          const sourceSize = change.sourceSize
            ? formatBytes(change.sourceSize)
            : 'Removed';
          const sizeChange = formatBytes(Math.abs(change.sizeChange));
          return `| ${change.name} | ${baseSize} | ${sourceSize} | ${sizeChange} |`;
        })
        .join('\n');

      messages.push(
        `## 🎉 Package Size Decrease

| 📦 Package | 📏 Base Size | 📏 Source Size | 📉 Size Change |
| --- | --- | --- | --- |
${packRows}`
      );
    }

    if (increases.length > 0) {
      const packRows = increases
        .map((change) => {
          const baseSize = change.baseSize
            ? formatBytes(change.baseSize)
            : 'New';
          const sourceSize = change.sourceSize
            ? formatBytes(change.sourceSize)
            : 'Removed';
          const sizeChange = formatBytes(change.sizeChange);
          return `| ${change.name} | ${baseSize} | ${sourceSize} | ${sizeChange} |`;
        })
        .join('\n');

      messages.push(
        `## ⚠️ Package Size Increase

| 📦 Package | 📏 Base Size | 📏 Source Size | 📈 Size Change |
| --- | --- | --- | --- |
${packRows}`
      );
    }

    return;
  }

  const totalSizeChange = comparison.packChanges.reduce(
    (sum, change) => sum + change.sizeChange,
    0
  );

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
