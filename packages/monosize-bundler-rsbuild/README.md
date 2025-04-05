# monosize-bundler-rsbuild

## Installation

```sh
# npm
npm install monosize-bundler-rsbuild --save-dev
# yarn
yarn add monosize-bundler-rsbuild --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-rsbuild`:

```js
// monosize.config.mjs
import rsbuildBundler from 'monosize-bundler-rsbuild';

export default {
  // ...
  bundler: rsbuildBundler(config => {
    // customize config here
    return config;
  }),
};
```

`rsbuildBundler` is a function that accepts a callback to customize the rsbuild configuration. The callback receives the default rsbuild configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import rsbuildBundler from 'monosize-bundler-rsbuild';

export default {
  // ...
  bundler: rsbuildBundler(config => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'some-package': 'some-package/dist/some-package.esm.js',
    };

    return config;
  }),
};
```
