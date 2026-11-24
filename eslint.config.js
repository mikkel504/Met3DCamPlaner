import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Flat Config: empfohlene JS- + TypeScript-Regeln.
 * core/ bleibt DOM-frei (Durchsetzung über Review/Tests), hier nur Codequalität.
 */
export default tseslint.config(
  // .opencode/skills/ enthaelt heruntergeladene Fremd-Skripte (Apple-HIG-Skill) – nicht unser Code
  { ignores: ['dist/**', 'node_modules/**', '.opencode/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
