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
- [Commands](#commands)
  - [`measure`](#measure)
  - [`compare-reports`](#compare-reports)
  - [`upload-report`](#upload-report)
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

export default {
  repository: 'https://github.com/__ORG__/__REPOSITORY__',
  storage: storageAdapter(),
  bundler: webpackBundler(config => {
    // customize config here
    return config;
  }),
};
```

### Bundler adapters

To build fixtures and produce artifacts you need to use a bundler adapter. Following adapters are available:

- [`monosize-bundler-webpack`](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-webpack)
- [`monosize-bundler-esbuild`](https://github.com/microsoft/monosize/tree/main/packages/monosize-bundler-esbuild)

### Storage adapters

To store reference results and run comparisons you need to use a storage adapter. Following adapters are available:

- [`monosize-storage-upstash`](https://github.com/microsoft/monosize/tree/main/packages/monosize-storage-upstash)

## Commands

### `measure`

```sh
monosize measure [--debug] [--quiet]
```

Builds fixtures and produces artifacts. For each fixture:

- `[fixture].fixture.js` - a modified fixture without a default export, used by a bundler
- `[fixture].output.js` - a fully minified file, used for measurements
- `[fixture].debug.js` - a partially minified file, useful for debugging (optional, if `--debug` is passed)

Produces a report file (`dist/bundle-size/monosize.json`) that is used by other steps.

### `compare-reports`

Compares local (requires call of `monosize measure` first) and remote results, provides output to CLI or to a Markdown file.

```sh
monosize compare-reports --branch=main --output=["cli"|"markdown"] --deltaFormat=["delta"|"percent"] [--quiet]
```

### `upload-report`

> Note: requires a configured storage adapter.

```sh
monosize upload-report --branch=main --commit-sha=HASH [--quiet]
```

Aggregates local results to a single report and uploads data to Azure Table Storage.

> Note: should be called only during CI builds.

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
