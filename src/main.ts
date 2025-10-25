import * as process from 'process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import type {PackageJson} from 'pkg-types';
import {join} from 'node:path';
import {parse as parseLockfile, type ParsedLockFile} from 'lockparse';
import {detectLockfile, computeDependencyVersions} from './lockfile.js';
import {getFileFromRef, getBaseRef, tryGetJSONFromRef} from './git.js';
import {getDependenciesFromPackageJson} from './npm.js';
import {getPacksFromPattern} from './packs.js';
import {scanForReplacements} from './checks/replacements.js';
import {scanForDuplicates} from './checks/duplicates.js';
import {scanForDependencyCount} from './checks/dependency-count.js';
import {scanForDependencySize} from './checks/dependency-size.js';
import {scanForProvenance} from './checks/provenance.js';
import {scanForBundleSize} from './checks/bundle-size.js';
import {formatBytes} from './common.js';

const COMMENT_TAG = '<!-- dependency-diff-action -->';

async function run(): Promise<void> {
  try {
    const baseWorkspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const workDir = core.getInput('working-directory') || '.';
    const workspacePath = join(baseWorkspace, workDir);
    core.info(`Workspace path is ${workspacePath}`);

    const baseRef = getBaseRef();
    const currentRef = github.context.sha;
    const lockfileFilename = detectLockfile(workspacePath);
    core.info(`Detected lockfile ${lockfileFilename}`);

    const token = core.getInput('github-token', {required: true});
    const prNumber = parseInt(core.getInput('pr-number', {required: true}), 10);
    const detectReplacements = core.getBooleanInput('detect-replacements');
    const dependencyThreshold = parseInt(
      core.getInput('dependency-threshold') || '10',
      10
    );
    const sizeThreshold = parseInt(
      core.getInput('size-threshold') || '100000',
      10
    );
    const duplicateThreshold = parseInt(
      core.getInput('duplicate-threshold') || '1',
      10
    );
    const packSizeThreshold = parseInt(
      core.getInput('pack-size-threshold') || '50000',
      10
    );

    if (Number.isNaN(prNumber) || prNumber < 1) {
      core.info('No valid pull request number was found. Skipping.');
      return;
    }

    if (!lockfileFilename) {
      core.info('No lockfile detected in the workspace. Exiting.');
      return;
    }
    const lockfilePath = join(workDir, lockfileFilename);
    core.info(`Using lockfile: ${lockfilePath}`);

    core.info(
      `Comparing package lockfiles between ${baseRef} and ${currentRef}`
    );

    const basePackageLock = getFileFromRef(
      baseRef,
      lockfilePath,
      baseWorkspace
    );
    if (!basePackageLock) {
      core.info('No package lockfile found in base ref');
      return;
    }

    const currentPackageLock = getFileFromRef(
      currentRef,
      lockfilePath,
      baseWorkspace
    );
    if (!currentPackageLock) {
      core.info('No package lockfile found in current ref');
      return;
    }

    const basePackageJson = tryGetJSONFromRef<PackageJson>(
      baseRef,
      'package.json',
      workspacePath
    );
    const currentPackageJson = tryGetJSONFromRef<PackageJson>(
      currentRef,
      'package.json',
      workspacePath
    );

    let parsedCurrentLock: ParsedLockFile;
    let parsedBaseLock: ParsedLockFile;

    try {
      parsedCurrentLock = await parseLockfile(
        currentPackageLock,
        lockfileFilename,
        currentPackageJson ?? undefined
      );
      core.info(
        `Parsed current lockfile with ${parsedCurrentLock.packages.length} packages`
      );
    } catch (err) {
      core.setFailed(`Failed to parse current lockfile: ${err}`);
      return;
    }
    try {
      parsedBaseLock = await parseLockfile(
        basePackageLock,
        lockfileFilename,
        basePackageJson ?? undefined
      );
      core.info(
        `Parsed base lockfile with ${parsedBaseLock.packages.length} packages`
      );
    } catch (err) {
      core.setFailed(`Failed to parse base lockfile: ${err}`);
      return;
    }

    const currentDeps = computeDependencyVersions(parsedCurrentLock);
    const baseDeps = computeDependencyVersions(parsedBaseLock);

    core.info(`Dependency threshold set to ${dependencyThreshold}`);
    core.info(`Size threshold set to ${formatBytes(sizeThreshold)}`);
    core.info(`Duplicate threshold set to ${duplicateThreshold}`);
    core.info(`Pack size threshold set to ${formatBytes(packSizeThreshold)}`);

    const messages: string[] = [];

    scanForDependencyCount(
      messages,
      dependencyThreshold,
      currentDeps,
      baseDeps
    );
    scanForDuplicates(
      messages,
      duplicateThreshold,
      currentDeps,
      lockfilePath,
      parsedCurrentLock
    );

    await scanForDependencySize(
      messages,
      sizeThreshold,
      currentDeps,
      baseDeps,
      parsedCurrentLock,
      parsedBaseLock
    );
    await scanForProvenance(messages, currentDeps, baseDeps);

    const basePackagesPattern = core.getInput('base-packages');
    const sourcePackagesPattern = core.getInput('source-packages');

    if (basePackagesPattern && sourcePackagesPattern) {
      try {
        core.info(
          `Comparing pack sizes between patterns: ${basePackagesPattern} and ${sourcePackagesPattern}`
        );

        const basePacks = await getPacksFromPattern(basePackagesPattern);
        const sourcePacks = await getPacksFromPattern(sourcePackagesPattern);

        core.info(
          `Found ${basePacks.length} base packs and ${sourcePacks.length} source packs`
        );

        await scanForBundleSize(
          messages,
          basePacks,
          sourcePacks,
          packSizeThreshold
        );
      } catch (err) {
        core.info(`Failed to compare pack sizes: ${err}`);
      }
    }

    if (detectReplacements) {
      if (!basePackageJson || !currentPackageJson) {
        core.setFailed(
          'detect-replacements requires both base and current package.json to be present'
        );
        return;
      }

      const baseDependencies = getDependenciesFromPackageJson(basePackageJson, [
        'optional',
        'peer',
        'dev',
        'prod'
      ]);
      const currentDependencies = getDependenciesFromPackageJson(
        currentPackageJson,
        ['optional', 'peer', 'dev', 'prod']
      );

      scanForReplacements(messages, baseDependencies, currentDependencies);
    }

    // Skip comment creation/update if there are no messages
    if (messages.length === 0) {
      core.info('No dependency warnings found. Skipping comment creation.');
      return;
    }

    const octokit = github.getOctokit(token);
    let existingCommentId: number | undefined = undefined;

    const perPage = 100;
    for await (const {data: comments} of octokit.paginate.iterator(
      octokit.rest.issues.listComments,
      {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        per_page: perPage
      }
    )) {
      // Search for the comment with the unique tag
      const comment = comments.find(
        (c) =>
          c.user &&
          c.user.login === 'github-actions[bot]' &&
          c.body?.includes(COMMENT_TAG)
      );
      if (comment) {
        existingCommentId = comment.id;
        break;
      }
    }

    const finalCommentBody = `${COMMENT_TAG}\n${messages.join('\n\n')}`;

    if (existingCommentId) {
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: existingCommentId,
        body: finalCommentBody
      });
      core.info(
        `Updated existing dependency diff comment #${existingCommentId}`
      );
    } else {
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        body: finalCommentBody
      });
      core.info('Created new dependency diff comment');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred.');
    }
  }
}

if (import.meta.main) {
  run();
}
