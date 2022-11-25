# monosize

A CLI tool to measure bundle size locally and on CI.

### Usage

> NOTE: `monosize` requires building packages first before doing any kind of measurements. Make sure to accommodate this in your pipeline

#### Fixtures

Fixtures declare exports that should be measured by the `monosize` tool. Fixtures are created inside each package.

For example:

```js
import { Component } from '@library/react-component';

console.log(Component);
// 👆 "console.log()" is the easiest way to prevent tree-shaking

export default {
  name: 'Component',
  // 👆 defines a name for story that will be used in output
};
```

### Configuration

For custom advanced behavior of `monosize`, you can create a `monosize.config.js` in the root of your project directory (next to `package.json`).

```
my-proj/
├─ src/
├─ monosize.config.js
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
monosize.config.js

```

#### Config API

```js
module.exports = {
  webpack: config => {
    // customize config here
    return config;
  },
};
```

### Commands

#### `compare-reports`

Compares local (requires call of `monosize measure` first) and remote results, provides output to CLI or to a Markdown file.

```sh
monosize compare-reports --branch=main --output=["cli"|"markdown"] [--quiet]
```

#### `measure`

```sh
monosize measure [--quiet]
```

Builds fixtures and produces artifacts. For each fixture:

- `[fixture].fixture.js` - a modified fixture without a default export, used by a bundler
- `[fixture].output.js` - a partially minified file, useful for debugging
- `[fixture].min.js` - a fully minified file, used for measurements

A report file `monosize.json` that is used by other steps.

#### `upload-report`

```sh
monosize upload-report --branch=main --commit-sha=HASH [--quiet]
```

Aggregates local results to a single report and uploads data to Azure Table Storage.

> NOTE: should be called only during CI builds.

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
