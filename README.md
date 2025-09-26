# e18e/action-dependency-diff

> A GitHub action for reporting differences in dependencies between two branches or commits.

## What it does

This action compares dependencies between your base branch and current branch, analyzing potential security and maintenance concerns:

- 🔒 **Provenance changes** - Detects loss of provenance
- ✅ **Trusted publisher changes** - Detects loss of trusted publish status
- 📈 **Dependency growth** - Warns when dependency count increases significantly
- 📦 **Install size** - Warns when package size increases significantly
- 🔄 **Duplicate versions** - Detects packages with multiple versions installed

## Usage

```yaml
name: Dependency Diff

on:
  pull_request:

jobs:
  diff_dependencies:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create Diff
        uses: e18e/action-dependency-diff@main
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `base-ref` | Base ref to compare against (defaults to main or PR target) | No | Auto-detected from PR or `main` |
| `github-token` | The GitHub token for authentication | Yes | `${{ github.token }}` |
| `pr-number` | The number of the pull request to comment on | Yes | `${{ github.event.pull_request.number }}` |
| `dependency-threshold` | Threshold for warning about significant increase in number of dependencies | No | `10` |
| `size-threshold` | Threshold (in bytes) for warning about significant increase in package size | No | `100000` |
| `duplicate-threshold` | Threshold for warning about packages with multiple versions | No | `1` |
| `base-packages` | Glob pattern for base branch pack files (e.g., `"./base-packs/*.tgz"`) | No | None |
| `source-packages` | Glob pattern for source branch pack files (e.g., `"./source-packs/*.tgz"`) | No | None |
| `pack-size-threshold` | Threshold (in bytes) for warning about significant increase in total pack size | No | `50000` |

## Example with custom inputs

```yaml
- name: Create Diff
  uses: e18e/action-dependency-diff@main
  with:
    base-ref: 'develop'
    dependency-threshold: '5'
    size-threshold: '50000'
```

## Package Bundle Analysis

In addition to analyzing dependency changes, this action can optionally compare the actual bundle sizes of your packages by examining `npm pack` outputs. This provides insights into the **bundle size** (what gets published) rather than just the **install size** (what gets installed with dependencies).

### Package Inputs

The action accepts glob patterns to locate package tarballs for comparison:

- **`base-packages`** - Glob pattern for base branch pack files (e.g., `"./base-packs/*.tgz"`)
- **`source-packages`** - Glob pattern for source branch pack files (e.g., `"./source-packs/*.tgz"`)
- **`pack-size-threshold`** - Threshold in bytes for warning about significant pack size increases

> [!NOTE]
> Package bundle analysis only runs when both `base-packages` and `source-packages` are provided. If these inputs are not set, this feature is skipped entirely.

### Example with package analysis

```yaml
jobs:
  build-main:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          ref: main # or your default branch
      - name: Use Node
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 24.x
      - name: Install Dependencies
        run: npm ci --ignore-scripts
      - name: Build
        run: npm run build
      - name: Pack
        run: npm pack
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: base-packages
          path: '*.tgz'
  build-pr:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
      - name: Use Node
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 24.x
      - name: Install Dependencies
        run: npm ci --ignore-scripts
      - name: Build
        run: npm run build
      - name: Pack
        run: npm pack
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: source-packages
          path: '*.tgz'
  diff_dependencies:
    runs-on: ubuntu-latest
    needs: [build-main, build-pr]
    permissions:
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          fetch-depth: 0 # allows the diff action to access git history
      - uses: actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5.0.0
        with:
          name: base-packages
          path: ./base-packages
      - uses: actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5.0.0
        with:
          name: source-packages
          path: ./source-packages
      - name: Create Diff
        uses: e18e/action-dependency-diff@main
        with:
          base-packages: ./base-packages/*.tgz
          source-packages: ./source-packages/*.tgz
```

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

## License

MIT
