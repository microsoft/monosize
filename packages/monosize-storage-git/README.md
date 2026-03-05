# monosize-storage-git

A storage adapter for [monosize](https://github.com/microsoft/monosize) that uses local git to store and retrieve bundle size reports.

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
    reportPath: 'bundle-size-report.json',
  }),
  bundler: /* your bundler adapter */,
};

export default config;
```

### How it works

**Reading reports (`compare-reports`)**:
- Reads the report file from the target branch using `git show {branch}:{reportPath}`
- No checkout or worktree switching needed

**Writing reports (`upload-report`)**:
- Writes the aggregated report to `reportPath` on disk
- Your CI pipeline is responsible for committing the file (e.g., on `main`)

### CI setup example

```yaml
# After running monosize measure && monosize upload-report:
- run: |
    git add bundle-size-report.json
    git commit -m "chore: update bundle size report" || true
    git push
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `reportPath` | `string` | Path to the report file in the repository, relative to the git root. |
