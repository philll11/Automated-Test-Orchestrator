// jest.config.js

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // We start with the ts-jest preset to get the basics for TypeScript
  preset: 'ts-jest',
  testEnvironment: 'node',

  // This is the key: a robust, multi-transformer setup
  transform: {
    // Use ts-jest for all TypeScript files
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
        useESM: true,
      },
    ],
    // Use babel-jest for all JavaScript files
    '^.+\\.jsx?$': 'babel-jest',
  },

  // CRITICAL: We override the default ignore pattern.
  // This tells Jest to NOT ignore the listed ESM modules so Babel can transform them.
  // It handles both Windows and Unix path separators.
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!.pnpm|uuid|chalk|ora)',
  ],

  // The moduleNameMapper is still needed for resolving ESM imports with extensions
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Standard test matching and setup
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
};