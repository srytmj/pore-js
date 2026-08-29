/**
 * Conventional Commits, enforced by the `.husky/commit-msg` hook.
 *
 * House style: `type(scope): <TASK-CODE> — <description>`, e.g.
 * `feat(core): I4 — vertical-JP text`. Scopes in use: `core`, `react`, `demo`,
 * `docs`. `subject-case` is off so the leading task code (I4, D3, P1 …) is
 * allowed.
 *
 * Commits are authored solely by the repository owner — never add `Co-authored-by`
 * or other co-author / attribution trailers.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    // bodies are prose and often contain "word: value" lines (CSS, config keys)
    // that the parser mistakes for footer tokens — don't nag about those
    'footer-leading-blank': [0],
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [1, 'always', 100],
  },
};
