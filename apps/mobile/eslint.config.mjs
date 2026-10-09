// Mobile uses the repository ESLint config plus the rules of hooks (React Native code is hook-heavy).
import hooks from 'eslint-plugin-react-hooks';
import root from '../../eslint.config.mjs';

export default [
  ...root,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
