# Change Log - monosize

This log was last generated on Tue, 27 Jan 2026 13:37:07 GMT and should not be manually modified.

<!-- Start content -->

## 0.8.0

Tue, 27 Jan 2026 13:37:07 GMT

### Minor changes

- feat: Add build-mode option, defaults to `batch` mode to improve build performance (pjsw@microsoft.com)

## 0.7.1

Mon, 08 Dec 2025 12:45:18 GMT

### Patches

- chore: use glob@13 (olfedias@microsoft.com)

## 0.7.0

Thu, 10 Jul 2025 14:01:30 GMT

### Minor changes

- chore: remove custom logging, add bundler name (olfedias@microsoft.com)

### Patches

- feat: add support for threshold (olfedias@microsoft.com)
- chore: unify logging (olfedias@microsoft.com)
- chore: bump production dependencies (olfedias@microsoft.com)

## 0.6.3

Tue, 06 Aug 2024 20:40:08 GMT

### Patches

- feat: implement --fixtures argument for measure CLI command (ben.keen@gmail.com)

## 0.6.2

Mon, 20 May 2024 09:09:44 GMT

### Patches

- feat: inline findGitRoot func and remove workspace-tools from deps in order to ship less JS (hochelmartin@gmail.com)
- fix: enable strict CLI mode in order to provide proper feedback when invalid commands/flags are used (hochelmartin@gmail.com)

## 0.6.1

Fri, 17 May 2024 08:39:46 GMT

### Patches

- fix: resolve default argument resolution bug within collectLocalReport (hochelmartin@gmail.com)

## 0.6.0

Thu, 16 May 2024 15:04:43 GMT

### Minor changes

- feat: create packageName from package.json or project.json by default and add packageName,packageRoot global configuration options overrides. [BREAKING-CHANGE] (hochelmartin@gmail.com)

## 0.5.1

Fri, 10 May 2024 09:04:46 GMT

### Patches

- feat: add `--artifacts-location` option to `monosize measure` (olfedias@microsoft.com)

## 0.5.0

Fri, 22 Mar 2024 14:27:41 GMT

### Minor changes

- feat: implement shared interface for createBunlder api (hochelmartin@gmail.com)

## 0.4.0

Sat, 16 Mar 2024 11:26:36 GMT

### Minor changes

- feat(monosize): unify reporters API and behaviours (hochelmartin@gmail.com)
- feat: make bundlers configurable [BREAKING] (olfedias@microsoft.com)
- feat: add deltaFormat to reporters API configurable via CLI (hochelmartin@gmail.com)

### Patches

- chore: replace Babel with Acorn (olfedias@microsoft.com)
- fix: delete proper directory in measure() (olfedias@microsoft.com)

## 0.3.0

Wed, 21 Feb 2024 16:37:56 GMT

### Minor changes

- breaking: output markdown reports directly to console (olfedias@microsoft.com)

### Patches

- feat: add debug mode to "measure" command (olfedias@microsoft.com)
- fix: do not parallel builds too much (olfedias@microsoft.com)

## 0.2.2

Tue, 20 Feb 2024 17:06:09 GMT

### Patches

- fix: improve Windows compat (olfedias@microsoft.com)

## 0.2.1

Fri, 22 Dec 2023 14:27:47 GMT

### Patches

- fix: add "--report-files-glob" to "compare-reports" (olfedias@microsoft.com)

## 0.2.0

Fri, 22 Dec 2023 13:44:44 GMT

### Minor changes

- feat: support repositories that contain a single package (olfedias@microsoft.com)

### Patches

- chore: bump Babel dependencies (olfedias@microsoft.com)

## 0.1.0

Mon, 13 Feb 2023 11:26:46 GMT

### Minor changes

- feat: export BundleSizeReportEntry type (olfedias@microsoft.com)

## 0.0.9

Mon, 12 Dec 2022 17:37:53 GMT

### Patches

- fix: update glob in collectLocalReport (olfedias@microsoft.com)

## 0.0.8

Sun, 27 Nov 2022 22:40:02 GMT

### Patches

- fix: remove usage of CJS vars, add linting (olfedias@microsoft.com)

## 0.0.7

Fri, 25 Nov 2022 16:53:18 GMT

### Patches

- fix: handle ESM configs, export config type (olfedias@microsoft.com)

## 0.0.6

Fri, 25 Nov 2022 16:20:16 GMT

### Patches

- fix: use esModuleInterop and "import *" (olfedias@microsoft.com)

## 0.0.5

Fri, 25 Nov 2022 15:17:27 GMT

### Patches

- fix: change a path to bin (olfedias@microsoft.com)

## 0.0.4

Fri, 25 Nov 2022 14:47:08 GMT

### Patches

- chore: bump dependencies (olfedias@microsoft.com)
