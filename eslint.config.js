import path from 'path';
import { fileURLToPath } from 'url';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import tsdoc from 'eslint-plugin-tsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '*.config.*'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      tsdoc,
    },
    rules: {
      // TSDoc: require doc comments on exported declarations
      'tsdoc/syntax': 'warn',

      // TypeScript strictness
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // General
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
