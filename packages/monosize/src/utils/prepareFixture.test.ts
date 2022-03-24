import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

import { prepareFixture } from './prepareFixture';

async function setup(fixtureContent: string): Promise<string> {
  const packageDir = tmp.dirSync({
    prefix: 'prepareFixture',
    unsafeCleanup: true,
  });

  const spy = jest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'monosize',
    unsafeCleanup: true,
  });
  const fixture = tmp.fileSync({
    dir: fixtureDir.name,
    name: 'test-fixture.js',
  });

  await fs.promises.writeFile(fixture.name, fixtureContent);

  return path.relative(packageDir.name, fixture.name);
}

describe('prepareFixture', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reads & removes metadata from a fixture file, writes it to "/dist"', async () => {
    const fixturePath = await setup(`import Component from '@react-component';
export default { name: 'Test fixture' }
`);
    const fixtureData = await prepareFixture(fixturePath);

    expect(fixtureData.relativePath).toMatch(/monosize[\\|/]test-fixture.js/);
    expect(fixtureData.name).toBe('Test fixture');

    expect(await fs.promises.readFile(fixtureData.absolutePath, 'utf8')).toMatchInlineSnapshot(
      `"import Component from '@react-component';"`,
    );
  });

  it('throws when metadata is not valid', async () => {
    const fixturePath = await setup(`import Component from '@react-component';
export default { foo: 'bar' }
`);

    await expect(prepareFixture(fixturePath)).rejects.toMatchInlineSnapshot(
      `[Error: unknown: Validation failed for a schema in a component: data must have required property 'name']`,
    );
  });

  it('throws when metadata is missing', async () => {
    const fixturePath = await setup(`import Component from '@fluentui/react-component';`);

    await expect(prepareFixture(fixturePath)).rejects.toMatchInlineSnapshot(`
      [Error: A fixture file should contain a default export with metadata.
      For example: export default { name: 'Test fixture' }]
    `);
  });
});
