# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

`monosize` is a CLI tool that measures bundle sizes for packages and monorepos and compares them against a stored baseline (typically `main`). This repo is itself a Yarn 4 + Nx monorepo of the CLI plus first-party adapter packages.

The `packages/` directory has three roles:

- `monosize` — the CLI (commands: `measure`, `compare-reports`, `upload-report`). Defines the `BundlerAdapter` and `StorageAdapter` contracts in `packages/monosize/src/types.mts`.
- `monosize-bundler-*` (webpack, esbuild, rspack) — implement `BundlerAdapter`. Each exposes a factory that takes a config-enhancer callback and returns `{ buildFixture, buildFixtures, name }`. `buildFixture` runs one fixture through the bundler; `buildFixtures` runs many in a single pass (multi-entry) and is what the CLI uses in default `--build-mode=batch`.
- `monosize-storage-*` (azure, git, upstash) — implement `StorageAdapter` (`getRemoteReport`, `uploadReportToRemote`).

Adapters are wired up by users in their own `monosize.config.mjs`; this repo does not consume itself end-to-end. When changing the `BundlerAdapter` / `StorageAdapter` shape, every adapter package must be updated in lockstep.

## Common commands

```sh
yarn build               # nx affected:build (since main)
yarn lint                # nx affected:lint
yarn test                # nx affected:test
yarn check-dependencies  # syncpack lint (prod + peer must align across packages)
yarn change              # beachball change — interactive prompt to create a change file (see below)
```

Per-package and full-graph operations (use `npx nx ...`):

```sh
npx nx run-many --target=build --all              # build everything
npx nx run-many --target=build --all --parallel --max-parallel=3
npx nx run <pkg>:build                            # e.g. monosize-bundler-webpack:build
npx nx run <pkg>:test
npx nx run <pkg>:lint
npx nx run <pkg>:typecheck                        # tsc --noEmit per package
```

Single test file or single test name (Vitest under the hood):

```sh
npx vitest run packages/monosize-bundler-webpack/src/runTerser.test.mts
npx vitest run -t 'should throw on compilation errors'
```

Note: tests resolve workspace packages via the `@monosize/source` condition (see `tsconfig.base.json` and each `vite.config.mts`), so tests pick up sibling-package changes from `src/` without a rebuild.

## Change files (beachball)

This repo follows semver and uses [beachball](https://microsoft.github.io/beachball/) to manage versioning and changelogs. **Every PR that modifies shipped code must include a change file** — CI runs `beachball check` on PRs (`.github/workflows/ci-change.yml`) and fails when one is missing.

```sh
yarn change              # interactive: pick a bump type per affected package, write a comment
yarn change -m "fix: ..." # non-interactive, reuse the same comment for all packages
npx beachball check      # what CI runs; verifies a change file exists for every affected package
```

`yarn change` is wired to `beachball change --no-commit`, so it stages the new file(s) under `change/<packageName>-<uuid>.json` but leaves committing to you. Each file looks like:

```json
{
  "type": "patch",
  "comment": "Fix bin script to import from dist instead of src",
  "packageName": "monosize",
  "email": "olfedias@microsoft.com",
  "dependentChangeType": "patch"
}
```

Notes:

- **Allowed bump types: `patch`, `minor`, `none`.** `major` is blocked by `disallowedChangeTypes` in `beachball.config.js`. Use `none` for changes that touch a package but shouldn't trigger a release (e.g. internal refactors with no consumer impact).
- **Pick the type from the comment prefix.** `fix:` → `patch`, `feat:` → `minor`, `chore:`/`docs:`/`refactor:`/`test:` → usually `none`. The comment becomes the changelog line, so write it for end users (no PR numbers, no internal jargon).
- **Files that don't require a change file** are listed in `beachball.config.js#ignorePatterns`: `__fixtures__/`, `*.test.mts`, `eslint.config.*`, `vite.config.mts`, `project.json`, `README.md`. PRs that only touch those (or repo-root tooling like workflows, `nx.json`, etc.) won't be flagged by `beachball check`.
- **One change file per affected package.** If a PR changes both `monosize` and `monosize-bundler-webpack`, expect two files — `yarn change` walks you through them.
- Change files are consumed and deleted by the release pipeline (`beachball publish`), which then commits `applying package updates` with the version bumps and CHANGELOG entries. Don't hand-edit `CHANGELOG.md` / `CHANGELOG.json`.

## Architecture notes

- **Source layout.** Every package is ESM, sources in `src/*.mts`, compiled output in `dist/`, declarations emitted via `tsc --build tsconfig.lib.json`. `tsconfig.spec.json` excludes `*.test.mts` from the lib build. `isolatedDeclarations` is on, so all exported APIs need explicit return types.
- **Source vs built consumption.** Each package's `exports` map has a `@monosize/source` condition pointing at `src/index.mts` and a `default` pointing at `dist/index.mjs`. Tooling configured with that condition (Vitest, type-checks, internal tools) reads sources directly; published consumers get the compiled output. Don't add cross-package imports that would bypass this — go through the public entry point.
- **Bundler adapter contract.** `BundlerAdapter.buildFixtures` is the batch path (3–15× faster); `buildFixture` is the sequential path used when the user passes `--build-mode=sequential`, which is mostly a debugging aid. Both must return paths that the CLI then sizes (raw + gzipped) and minifies for `.debug.js`.
- **`measure` output.** Each package produces `dist/bundle-size/monosize.json`; `compare-reports` and `upload-report` glob those (default `packages/**/dist/bundle-size/monosize.json`). Package-name resolution defaults to `package.json#name` / `project.json#name` and can be overridden via `MonoSizeConfig.reportResolvers`.
- **Versioning.** Beachball, configured in `beachball.config.js` — `disallowedChangeTypes: ['major']` (no major bumps allowed in this repo) and `gitTags: false`. The `precommit` hook in `beachball.hooks.js` runs `yarn install --no-immutable` after version bumps so the lockfile stays in sync; `prepublish` runs the full build before publishing so artifacts pick up the bumped versions.
- **Pre-commit.** `simple-git-hooks` runs `nano-staged`, which formats staged JS/TS/JSON via Prettier and refreshes Markdown TOCs via doctoc. Don't bypass with `--no-verify` — the lockfile-sync precommit hook above is part of the release flow.
- **Lint specifics.** `eslint.config.mjs` enforces `@nx/enforce-module-boundaries` and `import/no-extraneous-dependencies` (devDependencies disallowed in prod source). `*.mts` files additionally require `unicorn/prefer-module` and `unicorn/prefer-node-protocol` (`import path from 'node:path'`, not `'path'`). Tests, fixtures, and `vite.config.mts` are exempt from the extraneous-deps rule.
