import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import stylistic from '@stylistic/eslint-plugin';

export default [
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.stylistic,
    pluginReact.configs.flat.recommended,
    {
        plugins: {
            'react-hooks': pluginReactHooks,
            '@stylistic': stylistic
        },
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}']
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            ecmaVersion: 'latest',
        }
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                YT: 'readonly',
                FB: 'readonly',
                cast: 'readonly',
                chrome: 'readonly',
            }
        }
    },
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-redeclare': 'off',
            'eol-last': 'error',
            'eqeqeq': 'error',
            'no-console': ['error', {
                allow: [
                    'warn',
                    'error'
                ]
            }],
        }
    },
    {
        rules: {
            '@typescript-eslint/no-redeclare': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    'varsIgnorePattern': '_',
                    'caughtErrorsIgnorePattern': '_',
                }
            ],
        }
    },
    {
        rules: {
            '@stylistic/arrow-parens': 'error',
            '@stylistic/arrow-spacing': 'error',
            '@stylistic/block-spacing': 'error',
            '@stylistic/comma-spacing': 'error',
            '@stylistic/semi-spacing': 'error',
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/function-call-spacing': 'error',
            '@stylistic/semi': 'error',
            '@stylistic/no-extra-semi': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-multiple-empty-lines': ['error', {
                max: 1
            }],
            '@stylistic/indent': ['error', 4],
            '@stylistic/quotes': ['error', 'single'],
        }
    },
    {
        // These two imported Foundation modules are separately pinned by exact
        // Git blob identity. Keep semantic linting, but do not rewrite their
        // reviewed formatting or the intentional null-or-undefined comparison.
        files: [
            'src/routes/Player/intelligentSubtitles/preference-provenance.mjs',
            'src/routes/Player/intelligentSubtitles/preference-receipt.mjs',
        ],
        rules: {

            '@stylistic/arrow-parens': 'off',
            '@stylistic/arrow-spacing': 'off',
            '@stylistic/block-spacing': 'off',
            '@stylistic/comma-spacing': 'off',
            '@stylistic/semi-spacing': 'off',
            '@stylistic/space-before-blocks': 'off',
            '@stylistic/no-trailing-spaces': 'off',
            '@stylistic/function-call-spacing': 'off',
            '@stylistic/semi': 'off',
            '@stylistic/no-extra-semi': 'off',
            '@stylistic/eol-last': 'off',
            '@stylistic/no-multi-spaces': 'off',
            '@stylistic/no-multiple-empty-lines': 'off',
            '@stylistic/indent': 'off',
            '@stylistic/quotes': 'off',
        },
    },
    {
        // Preserve the reviewed null-or-undefined comparison without disabling
        // equality checks in the other imported provenance module.
        files: ['src/routes/Player/intelligentSubtitles/preference-provenance.mjs'],
        rules: {
            eqeqeq: ['error', 'always', { null: 'ignore' }],
        },
    },
    {
        rules: {
            'react/display-name': 'off',
        }
    }
];
