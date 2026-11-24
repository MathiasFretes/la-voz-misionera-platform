import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: [
      'scripts/verify-vps-admin.mjs',
      'scripts/verify-vps-content.mjs',
      'scripts/verify-vps-editorial.mjs',
      'scripts/verify-vps-identity.mjs',
      'scripts/verify-planning-journal.mjs',
      'scripts/verify-planning-ui.mjs',
      'scripts/verify-worship-review.mjs',
      'scripts/verify-worship-connected.mjs',
      'scripts/verify-native-session.mjs',
    ],
    languageOptions: {
      globals: {
        document: 'readonly',
        innerWidth: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
      },
    },
  },
  {
    files: [
      'suite-api/**/*.mjs',
      'scripts/build-native-gate-android.mjs',
      'scripts/native-android-gate.mjs',
      'scripts/native-gate-https-proxy.mjs',
      'scripts/native-gate-qa.mjs',
      'scripts/verify-native-connected.mjs',
      'scripts/verify-vps-admin.mjs',
      'scripts/verify-vps-content.mjs',
      'scripts/verify-vps-editorial.mjs',
      'scripts/verify-vps-identity.mjs',
      'scripts/verify-planning-journal.mjs',
      'scripts/verify-planning-ui.mjs',
      'scripts/verify-worship-review.mjs',
      'scripts/verify-worship-connected.mjs',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        AbortSignal: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
)
