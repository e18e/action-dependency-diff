import {formatBytes} from '../common.js';
import {comparePackSizes, type PackInfo} from '../packs.js';
import type {CheckResult} from './result.js';

function formatBytesSigned(bytes: number): string {
  return `${bytes > 0 ? '+' : ''}${formatBytes(bytes)}`;
}

export async function scanForBundleSize(
  basePacks: PackInfo[],
  sourcePacks: PackInfo[],
  threshold: number
): Promise<CheckResult | undefined> {
  if (basePacks.length === 0 && sourcePacks.length === 0) {
    return;
  }
  const comparison = comparePackSizes(basePacks, sourcePacks, threshold);

  const packWarnings = comparison.packChanges.filter(
    (change) => change.exceedsThreshold
  );

  if (threshold === -1 && packWarnings.length === 0) {
    return {
      check: 'bundle-size',
      breached: false,
      message: `## 📦 Package Bundle Size\n\nNo bundle size changes.`
    };
  }

  if (packWarnings.length > 0) {
    const hasDecreases = packWarnings.some((c) => c.sizeChange < 0);
    const hasIncreases = packWarnings.some((c) => c.sizeChange > 0);
    const heading =
      hasDecreases && hasIncreases
        ? '## 📦 Package Bundle Size Changes'
        : hasDecreases
          ? '## 🎉 Package Size Decrease'
          : '## ⚠️ Package Size Increase';
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

    const thresholdText =
      threshold === -1
        ? ''
        : `\nThese packages exceed the size change threshold of ${formatBytes(threshold)}:\n`;

    return {
      check: 'bundle-size',
      // with a threshold set, only increases over it are reported
      breached: threshold !== -1,
      message: `${heading}
${thresholdText}
| 📦 Package | 📏 Base Size | 📏 Source Size | 📈 Size Change |
| --- | --- | --- | --- |
${packRows}`
    };
  }
}
