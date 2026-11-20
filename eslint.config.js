import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['scripts/verify-vps-admin.mjs', 'scripts/verify-vps-content.mjs'],
    languageOptions: {
      globals: { document: 'readonly', innerWidth: 'readonly' },
    },
  },
  {
    files: [
      'suite-api/**/*.mjs',
      'scripts/verify-vps-admin.mjs',
      'scripts/verify-vps-content.mjs',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
)
