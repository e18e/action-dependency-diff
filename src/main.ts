import * as process from 'process';
import * as fs from 'node:fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';
import type {PackageJson} from 'pkg-types';
import {join} from 'node:path';
import {parse as parseLockfile, type ParsedLockFile} from 'lockparse';
import {
  detectLockfile,
  computeDependencyVersions,
  filterPackages,
  type FilterPackagesOptions
} from './lockfile.js';
import {
  getFileFromRef,
  getBaseRef,
  getCurrentRef,
  tryGetJSONFromRef
} from './git.js';
import {getDependenciesFromPackageJson, type DependencyType} from './npm.js';
import {getPacksFromPattern} from './packs.js';
import {scanForReplacements} from './checks/replacements.js';
import {scanForDuplicates} from './checks/duplicates.js';
import {scanForDependencyCount} from './checks/dependency-count.js';
import {scanForDependencySize} from './checks/dependency-size.js';
import {scanForProvenance} from './checks/provenance.js';
import {scanForLicenses} from './checks/license.js';
import {scanForInstallScripts} from './checks/install-scripts.js';
import {scanForBundleSize} from './checks/bundle-size.js';
import {formatBytes, parseCommaList} from './common.js';
import {
  type CheckName,
  type CheckResult,
  getFailedChecks,
  parseFailOn
} from './checks/result.js';
import {ARTIFACT_FILENAME, COMMENT_TAG} from './constants.js';
import {findExistingComment, upsertComment, writeJobSummary} from './github.js';

interface ArtifactResult {
  pr_number: number;
  body: string;
}

async function postCommentFromArtifact(): Promise<void> {
  const token = core.getInput('github-token', {required: true});
  const artifactPath = core.getInput('artifact-path');

  if (!artifactPath) {
    throw new Error(
      'No artifact-path was provided. This is required for comment-from-artifact mode.'
    );
  }

  core.info(`Reading artifact from ${artifactPath}`);

  const result: ArtifactResult = JSON.parse(
    await fs.readFile(artifactPath, 'utf-8')
  );

  core.info(`Posting comment to PR #${result.pr_number}`);

  const octokit = github.getOctokit(token);
  await upsertComment(octokit, result.pr_number, result.body);
}

async function analyzeAndComment(): Promise<void> {
  const baseWorkspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const mode = core.getInput('mode') || 'comment';
  const workDir = core.getInput('working-directory') || '.';
  const workspacePath = join(baseWorkspace, workDir);
  core.info(`Workspace path is ${workspacePath}`);

  const baseRef = getBaseRef();
  const currentRef = getCurrentRef();
  const lockfileFilename = detectLockfile(workspacePath);
  core.info(`Detected lockfile ${lockfileFilename}`);

  const token = core.getInput('github-token', {required: true});
  const prNumber = parseInt(core.getInput('pr-number', {required: true}), 10);
  const detectReplacements = core.getBooleanInput('detect-replacements');
  const detectLicenseChanges = core.getBooleanInput('detect-license-changes');
  const detectInstallScripts = core.getBooleanInput('detect-install-scripts');
  const excludeDevDependencies = core.getBooleanInput(
    'exclude-dev-dependencies'
  );
  const excludePackages = parseCommaList(core.getInput('exclude-packages'));
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
  const failOn = parseFailOn(core.getInput('fail-on'));

  if (Number.isNaN(prNumber) || prNumber < 1) {
    core.info('No valid pull request number was found. Skipping.');
    return;
  }

  if (!lockfileFilename) {
    core.info('No lockfile detected in the workspace. Exiting.');
    return;
  }
  const lockfilePath = join(workDir, lockfileFilename);
  const packageFilePath = join(workDir, 'package.json');
  core.info(`Using lockfile: ${lockfilePath}`);

  core.info(`Comparing package lockfiles between ${baseRef} and ${currentRef}`);

  const basePackageLock = getFileFromRef(baseRef, lockfilePath, baseWorkspace);
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
    packageFilePath,
    workspacePath
  );
  const currentPackageJson = tryGetJSONFromRef<PackageJson>(
    currentRef,
    packageFilePath,
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
    throw new Error(`Failed to parse current lockfile: ${err}`, {
      cause: err
    });
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
    throw new Error(`Failed to parse base lockfile: ${err}`, {
      cause: err
    });
  }

  const filterOptions: FilterPackagesOptions = {
    excludeDevDependencies,
    excludePackages
  };

  const currentDeps = computeDependencyVersions(
    filterPackages(parsedCurrentLock, filterOptions)
  );
  const baseDeps = computeDependencyVersions(
    filterPackages(parsedBaseLock, filterOptions)
  );

  core.info(`Dependency threshold set to ${dependencyThreshold}`);
  core.info(`Size threshold set to ${formatBytes(sizeThreshold)}`);
  core.info(`Duplicate threshold set to ${duplicateThreshold}`);
  core.info(`Pack size threshold set to ${formatBytes(packSizeThreshold)}`);

  const results: CheckResult[] = [];
  const addResult = (result: CheckResult | undefined): void => {
    if (result) {
      results.push(result);
    }
  };

  addResult(scanForDependencyCount(dependencyThreshold, currentDeps, baseDeps));

  if (duplicateThreshold > 0) {
    addResult(
      scanForDuplicates(
        duplicateThreshold,
        currentDeps,
        baseDeps,
        lockfilePath,
        parsedCurrentLock
      )
    );
  }

  addResult(
    await scanForDependencySize(
      sizeThreshold,
      currentDeps,
      baseDeps,
      parsedCurrentLock,
      parsedBaseLock
    )
  );
  addResult(await scanForProvenance(currentDeps, baseDeps));

  if (detectInstallScripts) {
    addResult(await scanForInstallScripts(currentDeps, baseDeps));
  }

  if (detectLicenseChanges) {
    addResult(await scanForLicenses(currentDeps, baseDeps));
  }

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

      addResult(
        await scanForBundleSize(basePacks, sourcePacks, packSizeThreshold)
      );
    } catch (err) {
      core.info(`Failed to compare pack sizes: ${err}`);
    }
  }

  if (detectReplacements) {
    if (!basePackageJson || !currentPackageJson) {
      throw new Error(
        'detect-replacements requires both base and current package.json to be present'
      );
    }

    const depTypes: DependencyType[] = excludeDevDependencies
      ? ['optional', 'peer', 'prod']
      : ['optional', 'peer', 'dev', 'prod'];

    const baseDependencies = getDependenciesFromPackageJson(
      basePackageJson,
      depTypes,
      excludePackages
    );
    const currentDependencies = getDependenciesFromPackageJson(
      currentPackageJson,
      depTypes,
      excludePackages
    );

    addResult(scanForReplacements(baseDependencies, currentDependencies));
  }

  const disabledChecks: CheckName[] = [];
  if (duplicateThreshold <= 0) disabledChecks.push('duplicates');
  if (!detectInstallScripts) disabledChecks.push('install-scripts');
  if (!detectLicenseChanges) disabledChecks.push('license');
  if (!detectReplacements) disabledChecks.push('replacements');
  if (!basePackagesPattern || !sourcePackagesPattern) {
    disabledChecks.push('bundle-size');
  }
  for (const check of disabledChecks) {
    if (failOn.has(check)) {
      core.warning(
        `fail-on includes "${check}", but that check is disabled so it can't fail the action`
      );
    }
  }

  const messages = results.map((result) => result.message);
  const failedChecks = getFailedChecks(results, failOn);

  const report =
    messages.length === 0
      ? '## e18e dependency analysis\n\nNo dependency warnings found.\n'
      : messages.join('\n\n');
  const commentBody = `${COMMENT_TAG}\n${report}`;

  await writeJobSummary(report);

  if (mode === 'artifact') {
    const tmpDir = join(baseWorkspace, '.e18e-tmp');
    const outputPath = join(tmpDir, ARTIFACT_FILENAME);

    await fs.mkdir(tmpDir, {recursive: true});
    await fs.writeFile(
      outputPath,
      JSON.stringify({pr_number: prNumber, body: commentBody})
    );

    core.setOutput('artifact-path', outputPath);
    core.info(`Wrote artifact to ${outputPath}`);
  } else {
    const octokit = github.getOctokit(token);

    if (messages.length > 0 || (await findExistingComment(octokit, prNumber))) {
      await upsertComment(octokit, prNumber, commentBody);
    } else {
      core.info('No dependency warnings found. Skipping comment creation.');
    }
  }

  // fail after the comment or artifact is written, so the report still
  // shows up on the pull request
  if (failedChecks.length > 0) {
    core.setFailed(`Dependency checks failed: ${failedChecks.join(', ')}`);
  }
}

async function run(): Promise<void> {
  try {
    const mode = core.getInput('mode') || 'comment';

    if (mode === 'comment-from-artifact') {
      await postCommentFromArtifact();
      return;
    }

    await analyzeAndComment();
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
