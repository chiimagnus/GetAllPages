import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: true,
    unocss: true,
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },
  },
  {
    rules: {
      // 浏览器扩展特定规则
      'no-console': 'warn',
      'no-debugger': 'error',

      // Vue 相关规则
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/component-definition-name-casing': ['error', 'PascalCase'],

      // TypeScript 相关规则
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',

      // 通用代码质量规则
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
  {
    files: ['src/background/**/*'],
    rules: {
      // 后台脚本可以使用console
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*'],
    rules: {
      // 构建脚本可以使用console
      'no-console': 'off',
    },
  },
)
