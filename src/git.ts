import {execFileSync} from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';

export function getFileFromRef(
  ref: string,
  filePath: string,
  cwd: string
): string | null {
  try {
    const content = execFileSync('git', ['show', `${ref}:${filePath}`], {
      encoding: 'utf8',
      cwd,
      stdio: 'pipe'
    });
    return content;
  } catch (err) {
    core.info(`Could not get ${filePath} from ${ref}: ${err}`);
    return null;
  }
}

export function getBaseRef(): string {
  const inputBaseRef = core.getInput('base-ref');
  if (inputBaseRef) {
    return inputBaseRef;
  }

  const githubBaseRef = github.context.payload.pull_request?.base.ref;

  if (githubBaseRef) {
    return `origin/${githubBaseRef}`;
  }

  return 'origin/main';
}
