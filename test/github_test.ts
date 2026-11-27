import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'process';
import * as github from '@actions/github';
import {upsertComment, writeJobSummary} from '../src/github.js';
import {COMMENT_TAG} from '../src/constants.js';
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

describe('upsertComment', () => {
  function createOctokit(comments: Array<{id: number; body: string}>) {
    const createComment = vi.fn();
    const updateComment = vi.fn();
    const listComments = vi.fn();
    const octokit = {
      paginate: {
        iterator: async function* () {
          yield {
            data: comments.map((c) => ({
              ...c,
              user: {login: 'github-actions[bot]'}
            }))
          };
        }
      },
      rest: {issues: {createComment, updateComment, listComments}}
    } as unknown as ReturnType<typeof github.getOctokit>;
    return {octokit, createComment, updateComment};
  }

  beforeEach(() => {
    vi.stubEnv('GITHUB_REPOSITORY', 'e18e/test-repo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearCoreLogs();
  });

  it('should create a comment if none exists', async () => {
    const {octokit, createComment, updateComment} = createOctokit([]);

    await upsertComment(octokit, 1, 'body');

    expect(createComment).toHaveBeenCalledOnce();
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('should update an existing comment', async () => {
    const {octokit, createComment, updateComment} = createOctokit([
      {id: 42, body: `${COMMENT_TAG}\nold`}
    ]);

    await upsertComment(octokit, 1, 'body', {createIfMissing: false});

    expect(updateComment).toHaveBeenCalledWith(
      expect.objectContaining({comment_id: 42, body: 'body'})
    );
    expect(createComment).not.toHaveBeenCalled();
  });

  it('should not create a comment when createIfMissing is false', async () => {
    const {octokit, createComment, updateComment} = createOctokit([
      {id: 7, body: 'someone else'}
    ]);

    await upsertComment(octokit, 1, 'body', {createIfMissing: false});

    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).not.toHaveBeenCalled();
    expect(coreLogs.info.join('\n')).toContain('skipping creation');
  });
});
