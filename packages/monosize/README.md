<div align="center">
  <img width="600" alt="A sample report produced by monosize" src="https://raw.githubusercontent.com/microsoft/monosize/main/.github/images/gh-report.png">
  <h1>monosize 📦</h1>
  <b>Mono</b>repo + bundle<b>size</b>
  <br/>
  <span>Monosize is a CLI tool to measure bundle size locally and on CI</span>
  <br />
  <br />
</div>

- 📚 Designed to be used in CI/CD pipelines
- 🎱 Designed to represent real-world scenarios
- 🧰 Supports single packages & monorepos
- 🍿 Supports various bundlers ([Webpack](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-webpack), [esbuild](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-esbuild), implement your own? 🐱)
- ☁️ Supports various storage adapters

<hr />

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Install](#install)
- [Usage](#usage)
  - [Fixtures](#fixtures)
- [Configuration](#configuration)
  - [Config API](#config-api)
  - [Bundler adapters](#bundler-adapters)
  - [Storage adapters](#storage-adapters)
  - [Threshold](#threshold)
- [Commands](#commands)
  - [`measure`](#measure)
    - [Options](#options)
    - [Examples](#examples)
  - [`compare-reports`](#compare-reports)
    - [Options](#options-1)
  - [`upload-report`](#upload-report)
    - [Options](#options-2)
- [Contributing](#contributing)
- [Trademarks](#trademarks)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Install

```sh
# yarn
yarn add --dev monosize

# npm
npm install --save-dev monosize
```

## Usage

> Note: `monosize` requires building packages first before doing any kind of measurements. Make sure to accommodate this in your pipeline

### Fixtures

Fixtures declare exports that should be measured by the `monosize` tool. Fixtures are created inside each package.

For example:

```js
import { Component } from '@library/component';

export { Component };
// 👆 "export" is required to be able to measure the size of the component

export default {
  name: 'Component',
  // 👆 defines a name for a fixture that will be used in output
};
```

## Configuration

You need to create a `monosize.config.mjs` in the root of your project directory (next to `package.json`) to configure storage and bundler adapters.

```
my-proj/
├─ src/
├─ monosize.config.mjs
├─ node_modules/
├─ bundle-size/
│  ├─ Fixture.fixture.js
├─ package.json
```

A global configuration can also be used for monorepo scenarios:

```
my-proj-a/
├─ src/
├─ node_modules/
├─ bundle-size/
│  ├─ Fixture.fixture.js
├─ package.json
my-proj-b/
├─ src/
├─ node_modules/
├─ bundle-size/
│  ├─ Fixture.fixture.js
├─ package.json
monosize.config.mjs
```

### Config API

```js
// monosize.config.mjs
import storageAdapter from 'monosize-storage-*';
import webpackBundler from 'monosize-bundler-webpack';

/** @type {import('monosize').MonoSizeConfig} */
const config = {
  repository: 'https://github.com/__ORG__/__REPOSITORY__',
  storage: storageAdapter(),
  bundler: webpackBundler(config => {
    // customize config here
    return config;
  }),

  // Optional `compare-reports`/`upload-reports` commands config overrides
  reportResolvers: {
    packageRoot: async reportFile => {
      // provide custom logic on how to resolve package root
      return '...';
    },
    packageName: async packageRoot => {
      // provide custom logic on how to resolve packageName used within reports
      return '...';
    },
  },

  threshold: '10kb', // default is "10%"
};

export default config;
```

### Bundler adapters

To build fixtures and produce artifacts you need to use a bundler adapter. Following adapters are available:

- [`monosize-bundler-webpack`](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-webpack)
- [`monosize-bundler-esbuild`](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-esbuild)

### Storage adapters

To store reference results and run comparisons you need to use a storage adapter. Following adapters are available:

- [`monosize-storage-upstash`](https://github.com/microsoft/monosize/tree/main/packages/monosize-storage-upstash)

### Threshold

The threshold is used to determine if the bundle size is acceptable. It can be set in the configuration file and can be a percentage (e.g., `10%`) or an absolute size (e.g., `10kb`). The default value is `10%`.

If the bundle size exceeds the threshold, the `compare-reports` command will fail with exit code `1`.

## Commands

### `measure`

```sh
monosize measure [--debug] [--artifacts-location] [--fixtures] [--single-build] [--quiet]
```

Builds fixtures and produces artifacts. For each fixture:

- `[fixture].fixture.js` - a modified fixture without a default export, used by a bundler
- `[fixture].output.js` - a fully minified file, used for measurements
- `[fixture].debug.js` - a partially minified file, useful for debugging (optional, if `--debug` is passed)

Produces a report file (`dist/bundle-size/monosize.json`) that is used by other steps.

#### Options

- `artifacts-location` - defines relative path from the package root where the artifact files will be stored (`monosize.json` & bundler output). If specified, `--report-files-glob` in `monosize collect-reports` & `monosize upload-reports` should be set accordingly.
- `fixtures` - optional argument to pass a fixture filename or globbing pattern. If not specified, all fixture files matching a `*.fixture.js` pattern will be measured.
- `single-build` - if true, all fixtures will be built in a single bundler run with multiple entry points. This can provide 3-15x performance improvement. Default: `false`.

#### Examples

`monosize measure --fixtures ba*` - matches any fixtures with filenames starting with `ba`
`monosize measure --fixtures Fixture.fixture.js` - matches a fixture with the exact filename
`monosize measure --single-build` - builds all fixtures in a single build for better performance

### `compare-reports`

Compares local (requires call of `monosize measure` first) and remote results, provides output to CLI or to a Markdown file.

```sh
monosize compare-reports --branch=main --output=["cli"|"markdown"] [--deltaFormat=["delta"|"percent"]] [--report-files-glob] [--quiet]
```

> [!TIP]
> In order to resolve package name used within report, we look for `package.json` or `project.json` by default to identify project root and use `#name` property from obtained configuration.
> If you have custom solution that needs changes please use monosize configuration API (`MonoSizeConfig.reportResolvers`).

#### Options

- `branch` - the branch to compare the results with, usually `main`
- `output` - defines the output formatter, either `cli` or `markdown`
- `deltaFormat` - defines the format of the delta column, either `delta` or `percent`
- `report-files-glob` - defines a glob pattern to search for report files, defaults to `packages/**/dist/bundle-size/monosize.json`

### `upload-report`

> [!CAUTION]
> Should be called only during CI builds.

> [!TIP]
> Requires a configured storage adapter.

> [!TIP]
> In order to resolve package name used within report, we look for `package.json` or `project.json` by default to identify project root and use `#name` property from obtained configuration.
> If you have custom solution that needs changes please use monosize configuration API (`MonoSizeConfig.reportResolvers`).

```sh
monosize upload-report --branch=main --commit-sha=HASH [--report-files-glob] [--quiet]
```

Aggregates local results to a single report and uploads data to Azure Table Storage.

#### Options

- `branch` - the branch to compare the results with, usually `main`
- `commit-sha` - the commit SHA to associate the report with
- `report-files-glob` - defines a glob pattern to search for report files, defaults to `packages/**/dist/bundle-size/monosize.json`

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
