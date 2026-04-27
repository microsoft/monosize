import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { prepareFixture } from './prepareFixture.mjs';

async function setup(fixtureContent: string) {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepareFixture'));
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepareFixture-artifacts'));

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir);

  const fixtureDir = path.join(packageDir, 'monosize');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const fixturePath = path.join(fixtureDir, 'test-fixture.js');

  await fs.promises.writeFile(fixturePath, fixtureContent);

  return {
    artifactsDir,
    fixturePath,
  };
}

describe('prepareFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('reads & removes metadata from a fixture file, writes it to "/dist"', async () => {
    const { artifactsDir, fixturePath } = await setup(`import Component from '@react-component';
export default { name: 'Test fixture' }
`);
    const fixtureData = await prepareFixture(artifactsDir, fixturePath);

    expect(fixtureData.artifactPath).toBe(path.resolve(artifactsDir, 'test-fixture.js'));
    expect(fixtureData.name).toBe('Test fixture');

    expect(fs.readFileSync(fixtureData.artifactPath, 'utf8')).toMatchInlineSnapshot(
      `
      "import Component from '@react-component';

      "
    `,
    );
  });

  it('throws when metadata is not valid', async () => {
    const { artifactsDir, fixturePath } = await setup(`import Component from '@react-component';
export default { foo: 'bar' }
`);

    await expect(prepareFixture(artifactsDir, fixturePath)).rejects.toMatchInlineSnapshot(
      `
      [Error: A default export should contain a property "name".
      For example: export default { name: 'Test fixture' }]
    `,
    );
  });

  it('throws when metadata is missing', async () => {
    const { artifactsDir, fixturePath } = await setup(`import Component from '@fluentui/react-component';`);

    await expect(prepareFixture(artifactsDir, fixturePath)).rejects.toMatchInlineSnapshot(`
      [Error: A fixture file should contain a default export with metadata.
      For example: export default { name: 'Test fixture' }]
    `);
  });
});
