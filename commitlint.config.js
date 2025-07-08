module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 放宽body行长度限制，因为自动生成的release commit可能包含长链接
    'body-max-line-length': [2, 'always', 200],
    // 放宽footer行长度限制
    'footer-max-line-length': [2, 'always', 200],
  },
}
