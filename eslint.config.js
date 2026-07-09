import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Intl: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        console: 'readonly',
        process: 'readonly'
      }
    }
  },
  {
    ignores: ['vendor/**', 'docs/**', 'node_modules/**']
  }
];
