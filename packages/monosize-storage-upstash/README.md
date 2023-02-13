<div align="center">
  <h1>monosize-storage-upstash</h1>
</div>

## Install

```sh
# yarn
yarn add --dev monosize-storage-upstash

# npm
npm install --save-dev monosize-storage-upstash
```

## Usage

- Create an account on [Upstash](https://upstash.com/)
- Create a Redis database
- Collect REST URL (`UPSTASH_REDIS_REST_URL`) and a **read-only** token (`UPSTASH_REDIS_REST_TOKEN`)
- Update `monosize.config.mjs`

### Configuration

```js
import upstashStorage from 'monosize-storage-upstash';

export default {
  repository: 'https://github.com/ORG/REPO',
  storage: upstashStorage({
    url: 'REST URL (UPSTASH_REDIS_REST_URL)',
    readonlyToken: 'Readonly token (UPSTASH_REDIS_REST_TOKEN)',
  }),
};
```
