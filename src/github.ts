import * as github from '@actions/github';
import * as core from '@actions/core';
import {COMMENT_TAG} from './constants.js';

type Octokit = ReturnType<typeof github.getOctokit>;

export async function findExistingComment(
  octokit: Octokit,
  prNumber: number
): Promise<number | undefined> {
  const {owner, repo} = github.context.repo;
  const perPage = 100;

  for await (const {data: comments} of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
    {
      owner,
      repo,
      issue_number: prNumber,
      per_page: perPage
    }
  )) {
    const comment = comments.find(
      (c) =>
        c.user &&
        c.user.login === 'github-actions[bot]' &&
        c.body?.includes(COMMENT_TAG)
    );
    if (comment) {
      return comment.id;
    }
  }

  return undefined;
}

export async function upsertComment(
  octokit: Octokit,
  prNumber: number,
  body: string
): Promise<void> {
  const {owner, repo} = github.context.repo;
  const existingCommentId = await findExistingComment(octokit, prNumber);

  if (existingCommentId) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingCommentId,
      body
    });
    core.info(`Updated existing dependency diff comment #${existingCommentId}`);
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
    core.info('Created new dependency diff comment');
  }
}
