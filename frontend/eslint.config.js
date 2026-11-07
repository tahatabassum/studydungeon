import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // Phaser code must not know about the backend or the demo rules.
    files: ['src/game/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/demo', '@/demo/*', '@/api', '@/api/*'],
              message: 'src/game must not import @/demo or @/api. Use the Event_Bridge.',
            },
          ],
        },
      ],
    },
  },
);
