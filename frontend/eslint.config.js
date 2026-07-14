/*
File: frontend/eslint.config.js
Blueprint Name: FrontendLinting

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-22

Description:
ESLint configuration for frontend TypeScript and React quality enforcement.

Features:
  - TypeScript-aware linting with recommended rule sets.
  - React hooks and refresh safety rules.

Security & Compliance:
  - Supports maintainable, reviewable code quality standards.
  - Reduces defect risk through static analysis guardrails.
*/

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
);
