import {parseCommaList} from '../common.js';

export const checkNames = [
  'dependency-count',
  'dependency-size',
  'duplicates',
  'provenance',
  'license',
  'install-scripts',
  'bundle-size',
  'replacements'
] as const;

export type CheckName = (typeof checkNames)[number];

export interface CheckResult {
  check: CheckName;
  message: string;
  // false for informational reports, e.g. a size decrease or a size report
  // shown because the threshold is -1
  breached: boolean;
}

function isCheckName(name: string): name is CheckName {
  return (checkNames as readonly string[]).includes(name);
}

export function parseFailOn(input: string): Set<CheckName> {
  const checks = new Set<CheckName>();
  for (const name of parseCommaList(input)) {
    if (!isCheckName(name)) {
      throw new Error(
        `Unknown check "${name}" in fail-on. Valid checks are: ${checkNames.join(', ')}`
      );
    }
    checks.add(name);
  }
  return checks;
}

export function getFailedChecks(
  results: CheckResult[],
  failOn: Set<CheckName>
): CheckName[] {
  return results
    .filter((result) => result.breached && failOn.has(result.check))
    .map((result) => result.check);
}
