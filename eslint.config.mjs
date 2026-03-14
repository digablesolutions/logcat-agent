// Flat ESLint config (ESLint v9+) with type-aware TypeScript rules
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const classRestrictionRule = [
  'error',
  {
    selector: 'ClassDeclaration',
    message:
      'Prefer functions, modules, or factories. Classes require an explicit allowlist entry for justified lifecycle, resource ownership, or Error subclass boundaries.',
  },
  {
    selector: 'ClassExpression',
    message:
      'Prefer functions, modules, or factories. Classes require an explicit allowlist entry for justified lifecycle, resource ownership, or Error subclass boundaries.',
  },
];

const isHookCall = (node, hookNames) => {
  if (node.callee.type === 'Identifier') {
    return hookNames.has(node.callee.name);
  }

  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'React' &&
    node.callee.property.type === 'Identifier' &&
    hookNames.has(node.callee.property.name)
  );
};

const collectDirectSetterCalls = (node, setterNames) => {
  const directCalls = [];

  const visit = (current) => {
    if (!current) return;

    switch (current.type) {
      case 'BlockStatement':
        current.body.forEach(visit);
        return;
      case 'ExpressionStatement':
        visit(current.expression);
        return;
      case 'IfStatement':
        visit(current.consequent);
        visit(current.alternate);
        return;
      case 'SwitchStatement':
        current.cases.forEach((switchCase) => switchCase.consequent.forEach(visit));
        return;
      case 'TryStatement':
        visit(current.block);
        if (current.handler) {
          visit(current.handler.body);
        }
        visit(current.finalizer);
        return;
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'LabeledStatement':
        visit(current.body);
        return;
      case 'ReturnStatement':
      case 'AwaitExpression':
      case 'TSAsExpression':
      case 'TSTypeAssertion':
      case 'TSNonNullExpression':
      case 'UnaryExpression':
        visit(current.argument);
        return;
      case 'VariableDeclaration':
        current.declarations.forEach((declaration) => {
          visit(declaration.init);
        });
        return;
      case 'AssignmentExpression':
        visit(current.right);
        return;
      case 'SequenceExpression':
        current.expressions.forEach(visit);
        return;
      case 'LogicalExpression':
        visit(current.left);
        visit(current.right);
        return;
      case 'ConditionalExpression':
        visit(current.consequent);
        visit(current.alternate);
        return;
      case 'ChainExpression':
        visit(current.expression);
        return;
      case 'CallExpression':
        if (current.callee.type === 'Identifier' && setterNames.has(current.callee.name)) {
          directCalls.push(current);
        }
        return;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        return;
      default:
        return;
    }
  };

  visit(node);
  return directCalls;
};

const localPlugin = {
  rules: {
    'no-direct-set-state-in-effect': {
      meta: {
        type: 'problem',
        docs: {
          description: 'disallow direct useState setter calls in effect bodies',
        },
        schema: [],
        messages: {
          directSetState:
            'Do not directly call a useState setter in an effect body. Derive during render, use an initializer, or move the update into an event, observer, or async callback.',
        },
      },
      create(context) {
        const hookNames = new Set(['useEffect', 'useLayoutEffect']);
        const setterNames = new Set();

        return {
          VariableDeclarator(node) {
            if (node.id.type !== 'ArrayPattern' || node.id.elements.length < 2) {
              return;
            }

            const setter = node.id.elements[1];
            if (!setter || setter.type !== 'Identifier' || !node.init || node.init.type !== 'CallExpression') {
              return;
            }

            if (isHookCall(node.init, new Set(['useState']))) {
              setterNames.add(setter.name);
            }
          },
          CallExpression(node) {
            if (!isHookCall(node, hookNames)) {
              return;
            }

            const callback = node.arguments[0];
            if (!callback || (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')) {
              return;
            }

            if (callback.body.type !== 'BlockStatement') {
              return;
            }

            collectDirectSetterCalls(callback.body, setterNames).forEach((directCall) => {
              context.report({
                node: directCall,
                messageId: 'directSetState',
              });
            });
          },
        };
      },
    },
  },
};

export default tseslint.config(
  // Ignore build artifacts and deps
  { ignores: ['dist/**', 'node_modules/**', 'website/dist/**', 'website/node_modules/**'] },

  // Type-aware and stylistic configs for TS (recommended, not strict)
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Project-specific typed rules for source files (repo main src only)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Keep important safety nets
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-restricted-syntax': classRestrictionRule,

      // Pragmatic relaxations for current codebase
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/consistent-generic-constructors': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'warn',
    },
  },

  // Website: typed rules with its own tsconfig
  {
    files: ['website/**/*.ts', 'website/**/*.tsx', 'website/*.ts', 'website/*.tsx'],
    plugins: {
      local: localPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: ['./website/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': classRestrictionRule,
      'local/no-direct-set-state-in-effect': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  // Explicit class allowlist for justified runtime boundaries in src/
  {
    files: [
      'src/errors.ts',
      'src/pluginManager.ts',
      'src/ai/openaiProvider.ts',
      'src/ai/geminiProvider.ts',
      'src/ai/realtime/analysisEngine.ts',
      'src/ai/realtime/anomalyDetector.ts',
      'src/ai/realtime/fileLogBuffer.ts',
      'src/ai/realtime/statePersistence.ts',
      'src/ai/realtime/trendAnalyzer.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Tests: use their own tsconfig and Vitest globals
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  {
    rules: {
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },

  // Disable stylistic conflicts with Prettier
  prettier
);
