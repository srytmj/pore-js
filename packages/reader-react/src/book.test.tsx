// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Book } from './book.js';

afterEach(cleanup);

describe('<Book>', () => {
  it('renders (builds its own source, no <ReaderProvider> needed)', () => {
    const { container } = render(
      <Book pages={['https://cdn/x/1.webp', 'https://cdn/x/2.webp']} meta={{ title: 'Test' }} />,
    );
    // the reader host div is present; the engine mount is a browser concern
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('throws up front when no src / pages / file is given', () => {
    expect(() => render(<Book meta={{ title: 'x' }} />)).toThrow(
      /one of .src., .pages., or .file./,
    );
  });
});
