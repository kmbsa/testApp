const eslintPluginReact = require('eslint-plugin-react');

module.exports = [
  {
    ignores: ['node_modules', 'android', 'ios', 'dist', 'build'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      react: eslintPluginReact,
      'react-native': require('eslint-plugin-react-native'),
      import: require('eslint-plugin-import'),
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'react-native/no-inline-styles': 'off',
      'react/react-in-jsx-scope': 'off',
      'import/order': ['warn', { groups: [['builtin', 'external', 'internal']] }],
    },
    settings: { react: { version: 'detect' } },
  },
];
