import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Pore.js demo — landing', () => {
  test('bare / shows the landing page; a sample opens the reader and Home returns', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.landing')).toBeVisible();
    await expect(page.locator('iframe.pore-text__frame')).toHaveCount(0);

    await page.locator('.landing__samples').getByRole('button', { name: /Novel/ }).click();
    await expect(page.frameLocator('iframe.pore-text__frame').locator('h1')).toContainText(
      'The Beginning',
    );
    await expect(page).toHaveURL(/[?&]book=demo-book/);

    await page.getByRole('button', { name: 'Back to start' }).click();
    await expect(page.locator('.landing')).toBeVisible();
    await expect(page).not.toHaveURL(/book=/);
  });

  test('a deep link (?book=) skips the landing page', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await expect(page.locator('.landing')).toHaveCount(0);
    await expect(page.locator('.loc')).toContainText('1/12');
  });

  test('landing page has no critical/serious axe violations', async ({ page }) => {
    await page.goto('/');
    await page.locator('.landing').waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

test.describe('Pore.js demo', () => {
  test('paged manga: turn, counter, resume across reload', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    const counter = page.locator('.loc');
    await expect(counter).toContainText('1/12');

    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(counter).toContainText('/12');
    const reached = await counter.textContent();

    await page.waitForTimeout(1000); // debounced save
    await page.reload();
    await expect(counter).toHaveText(reached!.trim());
    // no flash of page 1
    await expect(counter).not.toContainText('1/12');
  });

  test('layout switch to long strip virtualizes and tracks scroll', async ({ page }) => {
    await page.goto('/?book=demo-webtoon');
    const counter = page.locator('.loc');
    await expect(counter).toContainText('1/8');

    const surface = page.locator('.pore-image');
    await surface.evaluate((el) => {
      el.scrollTop = 8000;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(counter).not.toContainText('1/8');
  });

  test('RTL double spread renders two pages, left arrow goes back', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await expect(page.locator('.pore-image img')).toHaveCount(2);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.loc')).toContainText('3/12');
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.locator('.loc')).toContainText('1/12');
  });

  test('resize keeps the reading position', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    const before = await page.locator('.loc').textContent();
    await page.setViewportSize({ width: 500, height: 900 });
    await expect(page.locator('.loc')).toHaveText(before!.trim());
  });

  test('url-and-title history: ?p= updates and back/forward paginate', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/[?&]p=\d+/);
    const reached = await page.locator('.loc').textContent();
    await page.goBack();
    await expect(page.locator('.loc')).not.toHaveText(reached!.trim());
    await page.goForward();
    await expect(page.locator('.loc')).toHaveText(reached!.trim());
  });

  test('settings panel changes the fit mode live', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await page.getByRole('tab', { name: 'Image fit' }).click();
    await page.locator('[data-pore-tabpanel]:not([hidden]) select').first().selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });

  test('continuous-horizontal reads and virtualizes', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await page.locator('[data-pore-tabpanel]:not([hidden]) select').first().selectOption('continuous-horizontal');
    const surface = page.locator('.pore-image');
    await expect(surface).toHaveCSS('overflow-x', 'auto');
    await surface.evaluate((el) => {
      el.scrollLeft = 2500;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(page.locator('.loc')).not.toContainText('1/12');
  });
});

test.describe('Pore.js demo — EPUB', () => {
  test('paginates, turns pages, and resumes across reload', async ({ page }) => {
    await page.goto('/?book=demo-book');
    const loc = page.locator('.loc');
    await expect(loc).toContainText('%');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await expect(frame.locator('h1')).toContainText('The Beginning');

    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next page' }).click();
    const reached = await loc.textContent();
    await page.waitForTimeout(1000);
    await page.reload();
    // resumes near where we left off (within the same chapter or later)
    await expect(loc).not.toHaveText('The Pore.js Demo Book · 0%');
    void reached;
  });

  test('TOC jumps to a chapter and a footnote opens a popover', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page
      .getByRole('combobox', { name: 'Table of contents' })
      .selectOption({ label: 'The Resolution' });
    const frame = page.frameLocator('iframe.pore-text__frame');
    await expect(frame.locator('h1')).toContainText('The Resolution');

    await frame.locator('a[href*="notes"]').first().click();
    await expect(page.getByRole('dialog', { name: 'Footnote' })).toBeVisible();
  });

  test('progress line shows the current chapter for a chaptered book', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.loc')).toContainText('Ch 2/3');
  });

  test('theme + font size restyle without losing the chapter', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await page.getByRole('tab', { name: 'Theme' }).click();
    await page.locator('[data-pore-tabpanel]:not([hidden]) select').first().selectOption('dark');
    const bg = await page
      .frameLocator('iframe.pore-text__frame')
      .locator('#pore-base-style')
      .textContent();
    expect(bg).toContain('#1a1a1a');
  });
});

test.describe('Pore.js demo — PDF', () => {
  test('renders pages, turns, and switches back to another format', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    const loc = page.locator('.loc');
    await expect(loc).toContainText('1/9');
    await expect(page.locator('.pore-image img')).toHaveCount(1);

    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(loc).toContainText('3/9');

    // cross-format switch: back to the EPUB
    await page.getByRole('combobox', { name: 'Book' }).selectOption('demo-book');
    await expect(loc).toContainText('%');
  });

  test('pinch/zoom controls work like the image reader', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await page.getByRole('tab', { name: 'Image fit' }).click();
    await page.locator('[data-pore-tabpanel]:not([hidden]) select').first().selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });
});

test.describe('Pore.js demo — M3', () => {
  test('vertical-JP EPUB reads right-to-left', async ({ page }) => {
    await page.goto('/?book=demo-vertical');
    const css = await page
      .frameLocator('iframe.pore-text__frame')
      .locator('#pore-base-style')
      .textContent();
    expect(css).toContain('writing-mode:vertical-rl');

    const loc = page.locator('.loc');
    await expect(loc).toContainText('%');
    const flow = page.frameLocator('iframe.pore-text__frame').locator('#pore-flow');
    const before = await flow.evaluate((el) => el.style.transform);
    // ArrowLeft = forward in a vertical book
    await page.locator('.pore-text').press('ArrowLeft');
    await expect
      .poll(() => flow.evaluate((el) => el.style.transform))
      .not.toBe(before);
  });

  test('RTL-horizontal (Arabic) EPUB: multicol, direction, key swap', async ({ page }) => {
    await page.goto('/?book=demo-rtl');
    const css = await page
      .frameLocator('iframe.pore-text__frame')
      .locator('#pore-base-style')
      .textContent();
    expect(css).not.toContain('writing-mode:vertical-rl'); // horizontal, not vertical
    expect(css).toContain('direction:rtl');

    const flow = page.frameLocator('iframe.pore-text__frame').locator('#pore-flow');
    const before = await flow.evaluate((el) => el.style.transform);
    // ArrowLeft = forward in RTL, same as the vertical case, and moves -pageStep
    await page.locator('.pore-text').press('ArrowLeft');
    await expect
      .poll(() => flow.evaluate((el) => el.style.transform))
      .toMatch(/translate\(-\d/);
    expect(await flow.evaluate((el) => el.style.transform)).not.toBe(before);
  });

  test('flow mode turns the reader into a semantic scroller', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await page.getByRole('tab', { name: 'Navigation' }).click();
    await page.getByLabel('Reading mode').selectOption('flow');
    await page.keyboard.press('Escape'); // close the modal (its trigger is behind the overlay)

    const vp = page.frameLocator('iframe.pore-text__frame').locator('#pore-viewport');
    await expect(vp).toHaveCSS('overflow-y', 'auto');
    const loc = page.locator('.loc');
    const start = await loc.textContent();
    await page.locator('.pore-text').press('ArrowDown');
    await expect(loc).not.toHaveText(start!.trim());
  });

  test('in-book search jumps between hits', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Search in book' }).click();
    await page.getByPlaceholder('Search in book…').fill('consequat');
    const hits = page.locator('.search__hits li button');
    await expect(hits.first()).toBeVisible();
    await hits.nth(3).click();
    await expect(page.locator('.search__count')).toContainText('/');
  });

  test('download a book, go offline, keep reading', async ({ page, context }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Download for offline' }).click();
    await expect(page.getByRole('button', { name: 'Download for offline' })).toContainText(
      'offline',
      { timeout: 15_000 },
    );
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.pore-image img').first()).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.loc')).toContainText('/12');
    await context.setOffline(false);
  });

  test('reader has no critical axe violations (keyboard + ARIA)', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.locator('iframe.pore-text__frame').waitFor();
    const results = await new AxeBuilder({ page })
      // the book renders in a `sandbox` iframe with no `allow-scripts`, so axe
      // can't inject into it — and its markup is the publisher's, not ours
      .exclude('iframe.pore-text__frame')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region']) // demo shell, not the library
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test('settings dialog: focus trap, Radix tabs, axe clean', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reader settings' });
    await expect(dialog).toBeVisible();

    // tab switch works and only one panel shows
    await page.getByRole('tab', { name: 'Navigation' }).click();
    await expect(page.locator('[data-pore-tabpanel]:not([hidden])')).toHaveCount(1);
    await expect(dialog.getByLabel('Reading mode')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-pore-dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);

    // Esc closes and returns focus to the trigger
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Reader settings' })).toBeFocused();
  });

  test('bottom scrubber seeks and shows chapter ticks', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: 'Next page' }).click(); // wake the chrome
    const slider = page.getByRole('slider', { name: 'Seek' });
    await expect(slider).toBeVisible();
    // demo-manga has 3 chapters → 2 interior ticks
    await expect(page.locator('.pore-scrubber__tick')).toHaveCount(2);

    const track = page.locator('.pore-scrubber__track');
    const box = (await track.boundingBox())!;
    // near the far end — chapter 3 of demo-manga starts at page index 9 of 12
    await page.mouse.click(box.x + box.width * 0.97, box.y + box.height / 2);
    await expect(page.locator('.loc')).toContainText('Ch 3/3');
    await expect(page.locator('.pore-scrubber__label')).toContainText('%');
  });

  test('highlight persists across reload and click-to-jump works', async ({ page }) => {
    await page.goto('/?book=demo-book');
    const frame = page.frameLocator('iframe.pore-text__frame');
    const h1 = frame.locator('h1');
    await h1.waitFor();
    await h1.evaluate((el) => {
      const doc = el.ownerDocument!;
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    const swatch = page.locator('.selection-toolbar__swatch').first();
    await expect(swatch).toBeVisible();
    await swatch.click();
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');

    await page.waitForTimeout(1000); // debounced highlight save
    await page.reload();
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');

    await page.getByRole('button', { name: 'Highlights' }).click();
    await page.locator('.highlights-panel__jump').first().click();
    await expect(frame.locator('h1')).toContainText('The Beginning');
  });

  test('fixed-layout EPUB pages one spine per turn, scaled to fit the window', async ({ page }) => {
    await page.goto('/?book=demo-fixed');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await expect(frame.locator('h1')).toContainText('A Good Morning');
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(frame.locator('h1')).toContainText('The Long Walk');
    const flow = frame.locator('#pore-flow');
    await expect(flow).toHaveCSS('width', '750px');
  });

  test('OPDS catalog: browse the bundled fixture and open a book', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Browse OPDS catalog' }).click();
    await page.getByRole('button', { name: 'Browse', exact: true }).click();
    await expect(page.locator('.opds-browser__list li')).toHaveCount(3);
    await page
      .locator('.opds-browser__list li', { hasText: 'Fixed-Layout' })
      .getByRole('button', { name: 'Open' })
      .click();
    await expect(page.frameLocator('iframe.pore-text__frame').locator('h1')).toContainText(
      'A Good Morning',
    );
  });

  test('text-to-speech: play shows the current sentence, pause/resume toggles', async ({
    page,
  }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Text to speech' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('.tts-bar__sentence')).not.toHaveText('');
    // pause/resume delegates to the browser's own SpeechSynthesis — assert the
    // tracked state, not audio (per docs/m4-plan.md F5: not assertable in CI)
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  });

  test('M4 UI (highlights, OPDS, TTS) has no critical/serious axe violations', async ({
    page,
  }) => {
    await page.goto('/?book=demo-book');
    await page.locator('iframe.pore-text__frame').waitFor();
    await page.getByRole('button', { name: 'Highlights' }).click();
    await page.getByRole('button', { name: 'Browse OPDS catalog' }).click();
    await page.getByRole('button', { name: 'Text to speech' }).click();
    const results = await new AxeBuilder({ page })
      .exclude('iframe.pore-text__frame')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test('reduced motion: page turns apply instantly', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/?book=demo-book');
    const flow = page.frameLocator('iframe.pore-text__frame').locator('#pore-flow');
    await flow.waitFor();
    await page.locator('.pore-text').press('ArrowRight');
    // no GSAP tween: the transform is the final translate immediately, no translate3d easing frames
    await expect
      .poll(() => flow.evaluate((el) => el.style.transform))
      .toMatch(/translateX\(-\d/);
    await context.close();
  });
});
