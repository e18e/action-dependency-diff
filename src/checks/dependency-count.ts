import * as core from '@actions/core';

export function scanForDependencyCount(
  messages: string[],
  threshold: number,
  currentDeps: Map<string, Set<string>>,
  baseDeps: Map<string, Set<string>>
): void {
  const currentDepCount = Array.from(currentDeps.values()).reduce(
    (sum, versions) => sum + versions.size,
    0
  );
  const baseDepCount = Array.from(baseDeps.values()).reduce(
    (sum, versions) => sum + versions.size,
    0
  );
  const depIncrease = currentDepCount - baseDepCount;
  core.info(`Base dependency count: ${baseDepCount}`);
  core.info(`Current dependency count: ${currentDepCount}`);
  core.info(`Dependency count increase: ${depIncrease}`);

  if (depIncrease >= threshold) {
    messages.push(
      `## ⚠️ Dependency Count

This PR adds ${depIncrease} new dependencies (${baseDepCount} → ${currentDepCount}), which exceeds the threshold of ${threshold}.`
    );
  }
}
