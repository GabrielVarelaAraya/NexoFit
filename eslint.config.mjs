// Shared ESLint flat config for TypeScript packages.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Tipos generados por Supabase: incluyen `Views: {};` a propósito y la
    // forma vuelve al regenerarlos — se desactiva solo para ese archivo.
    files: ['**/database.types.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  }
);
