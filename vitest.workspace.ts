import { defineWorkspace } from 'vitest/config';

// reader-react gets a project here once it has unit tests; its behaviour is
// currently covered by the demo Playwright suite (apps/demo/e2e).
export default defineWorkspace(['packages/reader-core']);
