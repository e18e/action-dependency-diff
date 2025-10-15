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
      stdio: 'pipe',
      maxBuffer: 10000000000
    });
    return content;
  } catch {
    return null;
  }
}

export function tryGetJSONFromRef<T>(
  ref: string,
  filePath: string,
  cwd: string
): T | null {
  const content = getFileFromRef(ref, filePath, cwd);
  if (content) {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

export function getBaseRef(): string {
  const inputBaseRef = core.getInput('base-ref');

  if (inputBaseRef) {
    return inputBaseRef.includes('/') ? inputBaseRef : `origin/${inputBaseRef}`;
  }

  const githubBaseRef = github.context.payload.pull_request?.base.ref;

  if (githubBaseRef) {
    return `origin/${githubBaseRef}`;
  }

  return 'origin/main';
}
