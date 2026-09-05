import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'fixtures/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    files: ['**/*.config.{js,ts}', '**/*.cjs', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['apps/demo/public/*.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        console: 'readonly',
      },
    },
  },
);
