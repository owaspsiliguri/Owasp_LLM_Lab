module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  rules: { 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off' },
  overrides: [{ files: ['src/**/*.test.jsx', 'src/setupTests.js'], env: { jest: true }, globals: { vi: true, describe: true, it: true, expect: true, beforeEach: true, afterEach: true } }],
}
