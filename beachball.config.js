// @ts-check

/**
 * @type {import('beachball').BeachballConfig}
 */
module.exports = {
  gitTags: false,
  ignorePatterns: [
    '**/__fixtures__/**',
    '**/*.test.mts',
    '**/.eslintrc.json',
    '**/jest.config.js',
    '**/project.json',
    '**/README.md',
  ],
  hooks: require('./beachball.hooks'),
};
