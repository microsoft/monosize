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
    '**/vite.config.mts',
    '**/project.json',
    '**/README.md',
  ],
  hooks: require('./beachball.hooks'),
};
