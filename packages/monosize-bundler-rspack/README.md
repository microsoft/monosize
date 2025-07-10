# monosize-bundler-rspack

## Installation

```sh
# npm
npm install monosize-bundler-rspack --save-dev
# yarn
yarn add monosize-bundler-rspack --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-rspack`:

```js
// monosize.config.mjs
import rspackBundler from 'monosize-bundler-rspack';

export default {
  // ...
  bundler: rspackBundler(config => {
    // customize config here
    return config;
  }),
};
```

`rspackBundler` is a function that accepts a callback to customize the rsbuild configuration. The callback receives the default rsbuild configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import rspackBundler from 'monosize-bundler-rspack';

export default {
  // ...
  bundler: rspackBundler(config => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'some-package': 'some-package/dist/some-package.esm.js',
    };

    return config;
  }),
};
```
