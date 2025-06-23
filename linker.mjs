import fs from 'node:fs/promises';
import path from 'node:path';
import childProcess from 'node:child_process';

const CURRENT_DIR = path.resolve(process.cwd());
const TARGET_DIR = path.resolve(CURRENT_DIR, '..', 'fluentui');
// const TARGET_DIR = path.resolve(CURRENT_DIR, '..', 'teams-modular-packages');
// const TARGET_DIR = '/Users/olfedias/Downloads/ydlqgz';

const PACKAGES = ['monosize', 'monosize-bundler-webpack', 'monosize-bundler-rsbuild'];

export function sh(command, cwd, pipeOutputToResult = false) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const options = {
      cwd: cwd || process.cwd(),
      env: process.env,
      stdio: pipeOutputToResult ? 'pipe' : 'inherit',
      shell: true,
    };

    const child = childProcess.spawn(cmd, args, options);

    let stdoutData = '';

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdoutData += data;
      });
    }

    child.on('close', code => {
      if (code === 0) {
        resolve(stdoutData);
      }

      reject(new Error([`child process exited with code ${code}`, stdoutData].join('\n')));
    });
  });
}

// ----

const ASSETS = {};

await sh('yarn nx run-many --target=build --all', CURRENT_DIR);

for (const pkg of PACKAGES) {
  const pkgDirname = pkg.split('/').pop();
  const pkgDir = path.resolve(CURRENT_DIR, 'dist', 'packages', pkgDirname);

  await sh('npm pack', pkgDir);

  const pkgJson = await fs.readFile(path.resolve(pkgDir, 'package.json'), 'utf-8');
  const pkgVersion = JSON.parse(pkgJson).version;

  const tarName = pkg.replace('/', '-').replace(/^@/, '') + '-' + pkgVersion + '.tgz';
  const tarPath = path.resolve(pkgDir, tarName);
  const tarExists = await fs
    .access(tarPath)
    .then(() => true)
    .catch(() => false);

  if (!tarExists) {
    throw new Error(`Tarball ${tarName} does not exist in the target directory`);
  }

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const newTarName = tarName.replace('.tgz', `-${randomSuffix}.tgz`);
  const newPath = path.resolve(pkgDir, newTarName);

  await fs.rename(tarPath, newPath);
  ASSETS[pkg] = newPath;
}

console.log('Packages:', ASSETS);

// ----

const pkgJsonPath = path.resolve(TARGET_DIR, 'package.json');
const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));

const ARTIFACTS_DIR = path.resolve(TARGET_DIR, 'artifacts');

// await fs.rm(ARTIFACTS_DIR, { recursive: true, force: true });
// await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

pkgJson.resolutions = pkgJson.resolutions ?? {};

for (const [pkg, tarName] of Object.entries(ASSETS)) {
  const filename = path.basename(tarName);

  pkgJson.dependencies[pkg] = `file:./artifacts/${filename}`;
  pkgJson.resolutions[pkg] = `file:./artifacts/${filename}`;
  await fs.cp(tarName, path.resolve(ARTIFACTS_DIR, filename));
}

await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

console.log('Updated package.json:', pkgJson.resolutions);
