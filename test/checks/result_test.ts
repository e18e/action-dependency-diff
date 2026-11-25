import {describe, expect, it} from 'vitest';
import {
  type CheckResult,
  getFailedChecks,
  parseFailOn
} from '../../src/checks/result.js';

describe('parseFailOn', () => {
  it('should return an empty set for an empty input', () => {
    expect(parseFailOn('')).toEqual(new Set());
  });

  it('should parse a comma-separated list of checks', () => {
    expect(
      parseFailOn('dependency-count, dependency-size ,provenance')
    ).toEqual(new Set(['dependency-count', 'dependency-size', 'provenance']));
  });

  it('should throw on an unknown check', () => {
    expect(() => parseFailOn('dependency-count, size')).toThrow(
      'Unknown check "size" in fail-on'
    );
  });
});

describe('getFailedChecks', () => {
  const results: CheckResult[] = [
    {check: 'dependency-count', message: '', breached: true},
    {check: 'dependency-size', message: '', breached: false},
    {check: 'duplicates', message: '', breached: true}
  ];

  it('should return nothing when fail-on is empty', () => {
    expect(getFailedChecks(results, new Set())).toEqual([]);
  });

  it('should only return breached checks listed in fail-on', () => {
    expect(
      getFailedChecks(
        results,
        new Set(['dependency-count', 'dependency-size', 'provenance'])
      )
    ).toEqual(['dependency-count']);
  });
});
