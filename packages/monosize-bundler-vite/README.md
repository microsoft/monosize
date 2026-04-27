# monosize-bundler-vite

## Installation

```sh
# npm
npm install monosize-bundler-vite --save-dev
# yarn
yarn add monosize-bundler-vite --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-vite`:

```js
// monosize.config.mjs
import viteBundler from 'monosize-bundler-vite';

export default {
  // ...
  bundler: viteBundler(config => {
    // customize config here
    return config;
  }),
};
```

`viteBundler` is a function that accepts a callback to customize the Vite configuration. The callback receives the default Vite [`InlineConfig`](https://vite.dev/config/) and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import viteBundler from 'monosize-bundler-vite';

export default {
  // ...
  bundler: viteBundler(config => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'some-package': 'some-package/dist/some-package.esm.js',
    };

    return config;
  }),
};
```

#### Batch Build Mode

By default, monosize uses batch mode which runs builds for all fixtures concurrently. To use sequential mode instead (builds one fixture at a time):

```sh
monosize measure --build-mode=sequential
```
