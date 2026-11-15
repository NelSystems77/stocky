import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: ['.next/**', 'out/**', 'functions/**', 'node_modules/**'] },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
];

export default config;
