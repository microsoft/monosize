import AjvModule from 'ajv';
import { transformAsync } from '@babel/core';
import fs from 'node:fs';
import path from 'node:path';
import type { BabelFileResult } from '@babel/core';

import { fixtureSchema } from '../schemas.mjs';

type FixtureMetadata = {
  name: string;
};

export type PreparedFixture = {
  absolutePath: string;
  relativePath: string;
  name: string;
};

// FIXME: https://github.com/ajv-validator/ajv/issues/2047
const Ajv = AjvModule.default;
const ajv = new Ajv();

/**
 * Prepares a fixture file to be compiled with Webpack, grabs data from a default export and removes it.
 */
export async function prepareFixture(fixture: string): Promise<PreparedFixture> {
  const sourceFixturePath = path.resolve(process.cwd(), fixture);
  const sourceFixtureCode = await fs.promises.readFile(sourceFixturePath, 'utf8');

  const result = await transformAsync(sourceFixtureCode, {
    ast: false,
    code: true,

    // This instance of Babel should ignore all user's configs and apply only our plugin
    configFile: false, // https://babeljs.io/docs/en/options#configfile
    babelrc: false, // https://babeljs.io/docs/en/options#babelrc

    plugins: [
      // A Babel plugin that:
      // - reads metadata (name, threshold, etc.)
      // - removes a default export with metadata
      {
        visitor: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          ExportDefaultDeclaration(exportPath, state) {
            const evaluationResult = exportPath.get('declaration').evaluate();

            if (!evaluationResult.confident) {
              throw exportPath.buildCodeFrameError(
                [
                  'Failed to evaluate this fragment by Babel.',
                  'Ensure that an expression contains only simple literals and does not contain imported symbols.',
                ].join(' '),
              );
            }

            const valid = ajv.validate(fixtureSchema, evaluationResult.value);

            if (!valid) {
              throw new Error(`Validation failed for a schema in a component: ${ajv.errorsText(ajv.errors)}`);
            }

            state.file.metadata = evaluationResult.value;
            exportPath.remove();
          },
        },
      },
    ],
  });

  function isTransformedFixtureResultHasMetadata(
    value: BabelFileResult | null,
  ): value is BabelFileResult & { metadata: FixtureMetadata } {
    return Boolean(value && value.metadata && Object.keys(value.metadata).length);
  }

  if (!isTransformedFixtureResultHasMetadata(result)) {
    throw new Error(
      [
        'A fixture file should contain a default export with metadata.',
        "For example: export default { name: 'Test fixture' }",
      ].join('\n'),
    );
  }

  if (!result.code) {
    throw new Error(
      [
        `Babel did not return code in its results for the fixture "${fixture}".`,
        'Please check the fixture for syntax errors.',
      ].join('\n'),
    );
  }

  const outputFixturePath = path.resolve(process.cwd(), 'dist', fixture);

  await fs.promises.mkdir(path.dirname(outputFixturePath), { recursive: true });
  await fs.promises.writeFile(outputFixturePath, result.code);

  return {
    absolutePath: outputFixturePath,
    relativePath: fixture,

    name: result.metadata.name,
  };
}
