import {execFileSync} from 'child_process';
import * as process from 'process';
import * as core from '@actions/core';
import * as github from '@actions/github';

function getBaseRef(): string {
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

function getCurrentRef(): string {
  return github.context.sha ?? 'HEAD';
}

function getFileFromRef(
  ref: string,
  filePath: string,
  cwd: string
): string | null {
  try {
    const content = execFileSync('git', ['show', `${ref}:${filePath}`], {
      encoding: 'utf8',
      cwd
    });
    return content;
  } catch (err) {
    core.info(`Could not get ${filePath} from ${ref}: ${err}`);
    return null;
  }
}

declare function detectLockfile(workspacePath: string): string | undefined;
declare function parseLockFile(
  lockfilePath: string,
  contents: string
): Map<string, Set<string>>;

interface PackageMetadata {
  name: string;
  version: string;
  dist?: {
    unpackedSize?: number;
  };
}

async function fetchPackageMetadata(
  packageName: string,
  version: string
): Promise<PackageMetadata | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}/${version}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (err) {
    core.info(`Failed to fetch metadata for ${packageName}@${version}: ${err}`);
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const COMMENT_TAG = '<!-- dependency-diff-action -->';

async function run(): Promise<void> {
  try {
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const baseRef = getBaseRef();
    const currentRef = getCurrentRef();
    const lockfilePath = detectLockfile(workspacePath);
    const token = core.getInput('github-token', {required: true});
    const prNumber = parseInt(core.getInput('pr-number', {required: true}), 10);

    if (Number.isNaN(prNumber) || prNumber < 1) {
      core.info('No valid pull request number was found. Skipping.');
      return;
    }

    if (!lockfilePath) {
      core.info('No lockfile detected in the workspace. Exiting.');
      return;
    }

    core.info(
      `Comparing package-lock.json between ${baseRef} and ${currentRef}`
    );

    const basePackageLock = getFileFromRef(
      baseRef,
      lockfilePath,
      workspacePath
    );
    if (!basePackageLock) {
      core.info('No package-lock.json found in base ref');
      return;
    }
    const currentPackageLock = getFileFromRef(
      currentRef,
      lockfilePath,
      workspacePath
    );
    if (!currentPackageLock) {
      core.info('No package-lock.json found in current ref');
      return;
    }

    const currentDeps = parseLockFile(lockfilePath, currentPackageLock);
    const baseDeps = parseLockFile(lockfilePath, basePackageLock);

    const dependencyThreshold = parseInt(
      core.getInput('dependency-threshold') || '10',
      10
    );
    const sizeThreshold = parseInt(
      core.getInput('size-threshold') || '100000',
      10
    );

    let commentBody = '';

    // Count total dependencies (all package-version combinations)
    const currentDepCount = Array.from(currentDeps.values()).reduce(
      (sum, versions) => sum + versions.size,
      0
    );
    const baseDepCount = Array.from(baseDeps.values()).reduce(
      (sum, versions) => sum + versions.size,
      0
    );
    const depIncrease = currentDepCount - baseDepCount;

    if (depIncrease >= dependencyThreshold) {
      commentBody += `⚠️ **Dependency Count Warning**: This PR adds ${depIncrease} new dependencies (${baseDepCount} → ${currentDepCount}), which exceeds the threshold of ${dependencyThreshold}.\n\n`;
    }

    const newVersions: Array<{
      name: string;
      version: string;
      isNewPackage: boolean;
    }> = [];

    for (const [packageName, currentVersionSet] of currentDeps) {
      const baseVersionSet = baseDeps.get(packageName);

      for (const version of currentVersionSet) {
        if (!baseVersionSet || !baseVersionSet.has(version)) {
          newVersions.push({
            name: packageName,
            version: version,
            isNewPackage: !baseVersionSet
          });
        }
      }
    }

    if (newVersions.length > 0) {
      const sizeWarnings: string[] = [];

      for (const dep of newVersions) {
        try {
          const metadata = await fetchPackageMetadata(dep.name, dep.version);
          if (
            metadata?.dist?.unpackedSize &&
            metadata.dist.unpackedSize >= sizeThreshold
          ) {
            const label = dep.isNewPackage ? 'new package' : 'new version';
            sizeWarnings.push(
              `📦 **${dep.name}@${dep.version}** (${label}): ${formatBytes(metadata.dist.unpackedSize)}`
            );
          }
        } catch (err) {
          core.info(
            `Failed to check size for ${dep.name}@${dep.version}: ${err}`
          );
        }
      }

      if (sizeWarnings.length > 0) {
        commentBody += `⚠️ **Large Package Warnings** (threshold: ${formatBytes(sizeThreshold)}):\n\n${sizeWarnings.join('\n')}\n\n`;
      }
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
      const comment = comments.find((c) => c.body?.includes(COMMENT_TAG));
      if (comment) {
        existingCommentId = comment.id;
        break;
      }
    }

    const finalCommentBody = `${COMMENT_TAG}\n${commentBody}`;

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
