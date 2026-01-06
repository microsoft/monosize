# monosize-bundler-webpack

## Installation

```sh
# npm
npm install monosize-bundler-webpack --save-dev
# yarn
yarn add monosize-bundler-webpack --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-webpack`:

```js
// monosize.config.mjs
import webpackBundler from 'monosize-bundler-webpack';

export default {
  // ...
  bundler: webpackBundler(config => {
    // customize config here
    return config;
  }),
};
```

`webpackBundler` is a function that accepts a callback to customize the webpack configuration. The callback receives the default webpack configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import webpackBundler from 'monosize-bundler-webpack';

export default {
  // ...
  bundler: webpackBundler(config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'some-package': 'some-package/dist/some-package.esm.js',
    };

    return config;
  }),
};
```

## Performance Optimization

### Single Build Mode

The Webpack bundler supports a single-build mode that can significantly improve build performance when measuring multiple fixtures. Instead of running a separate Webpack build for each fixture, this mode runs a single build with multiple entry points.

To enable single-build mode, use the `--single-build` flag with the `measure` command:

```sh
monosize measure --single-build
```

**Performance benefits:**
- ~7-9x faster for typical monorepo scenarios
- Reduced overhead from Webpack initialization and configuration
- Single shared cache and compilation context

**When to use:**
- Large monorepos with many fixtures
- CI/CD pipelines where build time matters
- Local development for faster feedback

**Example:**

```sh
# Standard mode (builds each fixture separately)
monosize measure
# Takes: ~1200ms for 10 fixtures

# Single-build mode (builds all fixtures together)
monosize measure --single-build
# Takes: ~160ms for 10 fixtures (7.5x faster)
```

Note: Single-build mode is currently only available for the Webpack bundler.
