# monosize-bundler-esbuild

## Installation

```sh
# npm
npm install monosize-bundler-esbuild --save-dev
# yarn
yarn add monosize-bundler-esbuild --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-esbuild`:

```js
// monosize.config.mjs
import esbuildBundler from 'monosize-bundler-esbuild';

export default {
  // ...
  bundler: esbuildBundler(config => {
    // customize config here
    return config;
  }),
};
```

`esbuildBundler` is a function that accepts a callback to customize the configuration. The callback receives the default esbuild configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import esbuildBundler from 'monosize-bundler-esbuild';

export default {
  // ...
  bundler: esbuildBundler(config => {
    config.loader = {
      ...config.loader,
      '.svg': 'file',
    };

    return config;
  }),
};
```

#### Single Build Mode

Runs a single build with multiple entry points. 6-7x faster for typical scenarios.

```sh
monosize measure --single-build
```
