import type { JSONSchema7 } from 'json-schema';

export const fixtureSchema: JSONSchema7 = {
  $schema: 'http://json-schema.org/schema',
  $id: 'monosize-fixture',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
  additionalProperties: false,
};
