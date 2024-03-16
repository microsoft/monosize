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
