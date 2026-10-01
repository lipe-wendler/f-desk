// Conventional Commits com descrição em kebab-case: `tipo(escopo): descricao-em-kebab-case`.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'always', 'kebab-case'],
    'header-max-length': [2, 'always', 100],
  },
}
