import { parse } from 'acorn';
import type ES from 'acorn';
import fs from 'node:fs';
import path from 'node:path';

export type PreparedFixture = {
  absolutePath: string;
  relativePath: string;
  name: string;
};

/**
 * Prepares a fixture file to be compiled with a bundler, grabs data from a default export and removes it.
 */
export async function prepareFixture(fixture: string): Promise<PreparedFixture> {
  const sourceFixturePath = path.resolve(process.cwd(), fixture);
  const sourceFixtureCode = await fs.promises.readFile(sourceFixturePath, 'utf8');

  // A transform that:
  // - reads metadata (name, threshold, etc.)
  // - removes a default export with metadata

  const program = parse(sourceFixtureCode, {
    ecmaVersion: 2020,
    sourceType: 'module',
  });
  const defaultExport = program.body.find(node => node.type === 'ExportDefaultDeclaration') as
    | ES.ExportDefaultDeclaration
    | undefined;

  if (!defaultExport) {
    throw new Error(
      [
        'A fixture file should contain a default export with metadata.',
        "For example: export default { name: 'Test fixture' }",
      ].join('\n'),
    );
  }

  if (defaultExport.declaration.type !== 'ObjectExpression') {
    throw new Error(
      ['A default export should be an object expression.', "For example: export default { name: 'Test fixture' }"].join(
        '\n',
      ),
    );
  }

  const exportProperties = defaultExport.declaration.properties;
  const name = exportProperties.find(
    property => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === 'name',
  ) as ES.Property | undefined;

  if (!name) {
    throw new Error(
      [
        'A default export should contain a property "name".',
        "For example: export default { name: 'Test fixture' }",
      ].join('\n'),
    );
  }

  if (name.value.type !== 'Literal' || typeof name.value.value !== 'string') {
    throw new Error(
      ['A property "name" should be a string literal.', "For example: export default { name: 'Test fixture' }"].join(
        '\n',
      ),
    );
  }

  const modifiedCode = sourceFixtureCode.slice(0, defaultExport.start) + sourceFixtureCode.slice(defaultExport.end);
  const outputFixturePath = path.resolve(process.cwd(), 'dist', fixture);

  await fs.promises.mkdir(path.dirname(outputFixturePath), { recursive: true });
  await fs.promises.writeFile(outputFixturePath, modifiedCode);

  return {
    absolutePath: outputFixturePath,
    relativePath: fixture,

    name: name.value.value,
  };
}
