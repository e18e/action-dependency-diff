import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'process';
import {writeJobSummary} from '../src/github.js';
import {coreLogs, clearCoreLogs} from './util.js';

describe('writeJobSummary', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-summary-'));
  });

  afterEach(async () => {
    delete process.env['GITHUB_STEP_SUMMARY'];
    clearCoreLogs();
    await fs.rm(tmpDir, {recursive: true, force: true});
  });

  it('should write the report to the job summary', async () => {
    const summaryPath = path.join(tmpDir, 'summary.md');
    await fs.writeFile(summaryPath, '');
    process.env['GITHUB_STEP_SUMMARY'] = summaryPath;

    await writeJobSummary('## e18e dependency analysis\n\nsome report');

    const content = await fs.readFile(summaryPath, 'utf-8');
    expect(content).toContain('## e18e dependency analysis\n\nsome report');
  });

  it('should not throw if the job summary cannot be written', async () => {
    process.env['GITHUB_STEP_SUMMARY'] = path.join(tmpDir, 'missing.md');

    await expect(writeJobSummary('report')).resolves.toBeUndefined();
    expect(coreLogs.info.join('\n')).toContain('Failed to write job summary');
  });
});
