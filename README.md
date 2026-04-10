# e18e/action-dependency-diff

> A GitHub action for reporting differences in dependencies between two branches or commits.

## What it does

This action compares dependencies between your base branch and current branch, analyzing potential security and maintenance concerns:

- 🔒 **Package trust levels** - Detects decreases in package trust levels (provenance and trusted publisher status)
- 📈 **Dependency growth** - Warns when dependency count increases significantly
- 📦 **Install size** - Warns when package size increases significantly
- 🔄 **Duplicate versions** - Detects packages with multiple versions installed
- ⚠️ **Module replacements** - Identifies new packages that have community-recommended alternatives

## Usage

```yaml
name: Dependency Diff

on:
  pull_request:

jobs:
  diff_dependencies:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create Diff
        uses: e18e/action-dependency-diff@v1
```

## Inputs

| Name                   | Description                                                                                                                | Required | Default                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| `base-ref`             | Base ref to compare against (defaults to main or PR target)                                                                | No       | Auto-detected from PR or `main`           |
| `github-token`         | The GitHub token for authentication                                                                                        | Yes      | `${{ github.token }}`                     |
| `pr-number`            | The number of the pull request to comment on                                                                               | Yes      | `${{ github.event.pull_request.number }}` |
| `dependency-threshold` | Threshold for warning about significant increase in number of dependencies                                                 | No       | `10`                                      |
| `size-threshold`       | Threshold (in bytes) for warning about significant increase in package size                                                | No       | `100000`                                  |
| `duplicate-threshold`  | Threshold for warning about packages with multiple versions                                                                | No       | `1`                                       |
| `base-packages`        | Glob pattern for base branch pack files (e.g., `"./base-packs/*.tgz"`)                                                     | No       | None                                      |
| `source-packages`      | Glob pattern for source branch pack files (e.g., `"./source-packs/*.tgz"`)                                                 | No       | None                                      |
| `pack-size-threshold`  | Threshold (in bytes) for warning about significant increase in total pack size. Set to `-1` to always report size changes. | No       | `50000`                                   |
| `detect-replacements`  | Detect modules which have community suggested alternatives                                                                 | No       | `true`                                    |
| `working-directory`    | Working directory to scan for package lock file                                                                            | No       | None                                      |
| `mode`                 | Run mode: `comment`, `artifact`, or `comment-from-artifact`                                                                | No       | `comment`                                 |
| `artifact-path`        | Path to the artifact JSON file (for `comment-from-artifact` mode)                                                          | No       | None                                      |

## Example with custom inputs

```yaml
- name: Create Diff
  uses: e18e/action-dependency-diff@v1
  with:
    base-ref: 'develop'
    dependency-threshold: '5'
    size-threshold: '50000'
```

## Example Workflows

See the [`recipes/`](./recipes/) directory for complete workflow examples:

- [`basic/`](./recipes/basic/) - Basic dependency diff on pull requests
- [`artifact/`](./recipes/artifact/) - Two-workflow setup using artifacts (no `pull_request_target` needed)
- [`bundle-diff.yml`](./recipes/bundle-diff.yml) - Advanced workflow with package bundle size analysis

## Always Report Install Size

If you'd like to always report install size, whether it reduces or increases, you can set the `size-threshold` input to `-1`.

```yaml
- name: Create Diff
  uses: e18e/action-dependency-diff@v1
  with:
    size-threshold: -1
```

## Package Bundle Analysis

In addition to analyzing dependency changes, this action can optionally compare the actual bundle sizes of your packages by examining `npm pack` outputs. This provides insights into the **bundle size** (what gets published) rather than just the **install size** (what gets installed with dependencies).

### Package Inputs

The action accepts glob patterns to locate package tarballs for comparison:

- **`base-packages`** - Glob pattern for base branch pack files (e.g., `"./base-packs/*.tgz"`)
- **`source-packages`** - Glob pattern for source branch pack files (e.g., `"./source-packs/*.tgz"`)

> [!NOTE]
> Package bundle analysis only runs when both `base-packages` and `source-packages` are provided. If these inputs are not set, this feature is skipped entirely.

### Always Report Bundle Size Changes

To always report bundle size changes, set `pack-size-threshold` to `-1`. This will display bundle size differences even if they are reductions, giving you full visibility into how your changes affect the published package size.

```yaml
- name: Create Diff
  uses: e18e/action-dependency-diff@v1
  with:
    base-packages: './base-packs/*.tgz'
    source-packages: './source-packs/*.tgz'
    pack-size-threshold: -1
```

You can see an example of how to set this up in the [bundle difference workflow](./recipes/bundle-diff.yml).

## Module Replacements

This action automatically scans for new dependencies that have community-recommended replacements or alternatives.

The recommendations come from the [e18e community](https://e18e.dev) and include manifests for:

- Native alternatives
- Micro-utility alternatives
- Generally preferred packages

> [!NOTE]
> Module replacement suggestions are advisory and may not always be straightforward migrations. Review each recommendation carefully and use exclusion features if needed.

## Supported package managers

- npm (package-lock.json)
- Yarn (yarn.lock)
- pnpm (pnpm-lock.yaml)
- bun (bun.lock)

## Permissions

The action requires the following permissions:

```yaml
permissions:
  pull-requests: write # To comment on pull requests
```

## Artifact Mode

By default, the action posts a comment directly to the pull request. This requires `pull-requests: write` permission in the workflow that runs the analysis, which typically means using `pull_request_target` for fork PRs.

If you'd prefer not to use `pull_request_target`, you can use a two-workflow setup with artifact mode:

1. **Analyze workflow** (`pull_request`) - runs the analysis and uploads the result as an artifact:

```yaml
- name: Analyze Dependencies
  uses: e18e/action-dependency-diff@v1
  with:
    mode: artifact
```

2. **Comment workflow** (`workflow_run`) - downloads the artifact and posts the comment:

```yaml
- name: Post Comment
  uses: e18e/action-dependency-diff@v1
  with:
    mode: comment-from-artifact
```

See the [`recipes/artifact/`](./recipes/artifact/) directory for complete workflow files.

## Trust levels of packages

The following levels are considered when evaluating package trust:

- **Trusted Publisher (with provenance)** (highest)
- **Provenance**
- **None**

When a package's trust level decreases (e.g., from Trusted Publisher to Provenance), it is flagged in the report.

### `provenance-action` GitHub Action

If you want more information on _why_ the trust level changed, or want to detect changes to the provenance information, we highly recommend using the [provenance-action](https://github.com/danielroe/provenance-action) in addition to this.

The provenance action will tell you exactly what changed in the provenance information. For example, if the repository changed between two versions.

## Sponsors

<p align="center">
  <a href="https://e18e.dev/sponsor">
    <img src="https://e18e.dev/sponsors.svg" alt="e18e community sponsors" />
  </a>
</p>

## License

MIT
