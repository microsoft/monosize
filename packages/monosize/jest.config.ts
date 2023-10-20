/* eslint-disable */
export default {
  displayName: 'monosize',
  preset: '../../jest.preset.js',
  globals: {},
  resolver: '<rootDir>/../../jest.resolver.js',
  coverageDirectory: '../../coverage/packages/monosize',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transformIgnorePatterns: ['/node_modules/', '/monosize.config.js/'],
};
