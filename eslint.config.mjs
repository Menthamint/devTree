/**
 * eslint.config.mjs — Flat ESLint configuration.
 *
 * Rule layers (applied in order, later rules take precedence):
 *   1. Next.js core-web-vitals  — React, JSX, accessibility, import hygiene
 *   2. Next.js TypeScript       — @typescript-eslint recommended
 *   3. SonarJS                  — code-quality & complexity rules
 *   4. Storybook                — story-file specific rules
 *   5. Custom overrides         — project-specific tweaks
 *   6. Test-file relaxations    — loosen rules for *.test.* and *.stories.*
 *   7. Prettier                 — MUST be last to disable all formatting rules
 *
 * ─── WHY eslint-config-next? ──────────────────────────────────────────────────
 * Next.js bundles a curated set of rules from:
 *   - @typescript-eslint (type-aware linting)
 *   - eslint-plugin-react + react-hooks
 *   - eslint-plugin-jsx-a11y (accessibility)
 *   - eslint-plugin-import
 * Deferring to next's bundle avoids version conflicts with manually installed
 * @typescript-eslint packages.
 *
 * ─── WHY SonarJS? ─────────────────────────────────────────────────────────────
 * SonarJS detects deeper code-quality issues that @typescript-eslint misses:
 * cognitive complexity, duplicated code, empty callbacks, etc.
 *
 * ─── WHY eslint-plugin-unused-imports? ───────────────────────────────────────
 * @typescript-eslint/no-unused-vars can't auto-fix. unused-imports/no-unused-imports
 * CAN auto-fix (removes entire import lines), making `eslint --fix` useful for
 * cleaning up after refactors.
 */
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import storybook from 'eslint-plugin-storybook';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  // ── 1. Next.js base (React + TS + a11y + hooks) ──────────────────────────
  ...nextVitals,
  ...nextTs,

  // ── 2. SonarJS code-quality rules ────────────────────────────────────────
  sonarjs.configs.recommended,

  // ── 3. Storybook rules (applied only to story files) ─────────────────────
  ...storybook.configs['flat/recommended'],

  // ── 4. Custom rules & plugin additions ───────────────────────────────────
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // ── Unused imports (auto-fixable) ──────────────────────────────────
      // Turn off the base rule so we don't get double reports
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // ── TypeScript ──────────────────────────────────────────────────────
      // Enforce `import type` for type-only imports — keeps runtime bundles smaller
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // Warn (not error) on `any` — sometimes unavoidable with third-party types
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── React / Next.js ─────────────────────────────────────────────────
      // Allow JSX without importing React (Next.js handles this automatically)
      'react/react-in-jsx-scope': 'off',
      // Warn on missing display names only in non-test files
      'react/display-name': 'warn',

      // ── SonarJS tweaks ─────────────────────────────────────────────────
      // Duplicate string literals are common in Tailwind class names — warn only
      'sonarjs/no-duplicate-string': 'warn',
      // Marker comments (tag-style) in code are acceptable; only warn, not error
      'sonarjs/todo-tag': 'warn',
    },
  },

  // ── 5. Relaxed rules for test and story files ─────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx'],
    rules: {
      // Duplicate strings are fine in test assertions and story args
      'sonarjs/no-duplicate-string': 'off',
      // Redundant type aliases and task-tag comments are acceptable in test/story files
      'sonarjs/redundant-type-aliases': 'off',
      'sonarjs/todo-tag': 'off',
      // Any-types are sometimes needed for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      // Test files typically use side-effect imports (e.g. @testing-library/jest-dom)
      'unused-imports/no-unused-imports': 'warn',
      // Consistent-type-imports can break some vitest patterns
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // ── 6. Global ignores ────────────────────────────────────────────────────
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    '**/bin/**',
    '**/obj/**',
    '**/.playwright/**',
    'next-env.d.ts',
    'prisma/migrations/**',
    'coverage/**',
    'storybook-static/**',
  ]),

  // ── 7. Prettier — MUST be last ───────────────────────────────────────────
  // Disables all ESLint formatting rules that conflict with Prettier output.
  // If a rule is re-enabled after this, it WILL conflict with Prettier.
  prettierConfig,
]);

export default eslintConfig;
