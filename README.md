# @e18e/action-dependency-diff

> A GitHub action for reporting differences in dependencies between two branches or commits.

## What it does

This action compares dependencies between your base branch and current branch, analyzing potential security and maintenance concerns:

- 🔒 **Provenance changes** - Detects loss of provenance
- ✅ **Trusted publisher changes** - Detects loss of trusted publish status
- 📈 **Dependency growth** - Warns when dependency count increases significantly
- 📦 **Install size** - Warns when package size increases significantly

## Usage

```yaml
name: Dependency Diff

on:
  pull_request:
    types: [opened]

jobs:
  diff_dependencies:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Create Diff
        uses: e18e/action-dependency-diff@main
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `base-ref` | Base ref to compare against (defaults to main or PR target) | Yes | `main` |
| `github-token` | The GitHub token for authentication | Yes | `${{ github.token }}` |
| `pr-number` | The number of the pull request to comment on | Yes | `${{ github.event.pull_request.number }}` |
| `dependency-threshold` | Threshold for warning about significant increase in number of dependencies | No | `10` |
| `size-threshold` | Threshold (in bytes) for warning about significant increase in package size | No | `100000` |

## Example with custom inputs

```yaml
- name: Create Diff
  uses: e18e/action-dependency-diff@main
  with:
    base-ref: 'develop'
    dependency-threshold: '5'
    size-threshold: '50000'
```

## Supported package managers

- npm (package.json)
- Yarn (package.json)
- pnpm (package.json)

## Permissions

The action requires the following permissions:

```yaml
permissions:
  pull-requests: write  # To comment on pull requests
```

## License

MIT
