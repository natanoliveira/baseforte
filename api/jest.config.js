module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  rootDir: '.',
  testRegex: '(src|test)/.*\\.(spec|e2e-spec)\\.ts$',
};
