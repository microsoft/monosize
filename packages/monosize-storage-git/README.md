# monosize-storage-git

A storage adapter for [monosize](https://github.com/microsoft/monosize) that uses GitHub Actions artifacts to store and retrieve bundle size reports.

## Install

```sh
# yarn
yarn add --dev monosize-storage-git

# npm
npm install --save-dev monosize-storage-git
```

## Usage

```js
// monosize.config.mjs
import gitStorage from 'monosize-storage-git';

/** @type {import('monosize').MonoSizeConfig} */
const config = {
  repository: 'https://github.com/__ORG__/__REPOSITORY__',
  storage: gitStorage({
    owner: '__ORG__',
    repo: '__REPOSITORY__',
    workflowFileName: 'bundle-size.yml',
  }),
  bundler: /* your bundler adapter */,
};

export default config;
```

## How it works

**Reading reports (`compare-reports`)**:

- Uses the GitHub API (via [Octokit](https://github.com/octokit/rest.js)) to list the last 5 completed workflow runs on the target branch
- Downloads the first artifact matching `artifactName` and extracts the report JSON
- Requires a `GITHUB_TOKEN` environment variable (available by default in GitHub Actions)

**Writing reports (`upload-report`)**:

- This adapter does **not** upload reports directly
- Instead, use the [`actions/upload-artifact`](https://github.com/actions/upload-artifact) GitHub Action to upload your report as a workflow artifact

## CI setup example

Your workflow needs two steps: one to generate the report and one to upload it as an artifact.

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size

on:
  push:
    branches: [main]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: yarn install

      - name: Measure bundle size
        run: yarn monosize measure

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: monosize-report
          path: dist/bundle-size-report.json
```

Then, in your PR workflow, compare against the report from the base branch:

```yaml
# .github/workflows/bundle-size-compare.yml
name: Bundle Size Compare

on: pull_request

jobs:
  compare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: yarn install

      - name: Compare bundle size
        run: yarn monosize compare-reports --branch main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note:** The artifact name in `actions/upload-artifact` must match the `artifactName` config option (defaults to `'monosize-report'`).

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `owner` | `string` | Yes | GitHub repository owner (org or user). |
| `repo` | `string` | Yes | GitHub repository name. |
| `workflowFileName` | `string` | Yes | Workflow filename to search runs from (e.g. `'bundle-size.yml'`). |
| `artifactName` | `string` | No | Name of the workflow artifact. Defaults to `'monosize-report'`. |
