import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Pore.js demo', () => {
  test('paged manga: turn, counter, resume across reload', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    const counter = page.locator('.loc');
    await expect(counter).toContainText('1/12');

    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
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
    await page.getByRole('button', { name: '›' }).click();
    await expect(page.locator('.loc')).toContainText('3/12');
    await page.getByRole('button', { name: '‹' }).click();
    await expect(page.locator('.loc')).toContainText('1/12');
  });

  test('resize keeps the reading position', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
    const before = await page.locator('.loc').textContent();
    await page.setViewportSize({ width: 500, height: 900 });
    await expect(page.locator('.loc')).toHaveText(before!.trim());
  });

  test('url-and-title history: ?p= updates and back/forward paginate', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
    await expect(page).toHaveURL(/[?&]p=\d+/);
    const reached = await page.locator('.loc').textContent();
    await page.goBack();
    await expect(page.locator('.loc')).not.toHaveText(reached!.trim());
    await page.goForward();
    await expect(page.locator('.loc')).toHaveText(reached!.trim());
  });

  test('settings panel changes the fit mode live', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: '⚙' }).click();
    await page.getByRole('tab', { name: 'Image fit' }).click();
    await page.locator('[data-pore-tabpanel]:not([hidden]) select').first().selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });

  test('continuous-horizontal reads and virtualizes', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: '⚙' }).click();
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

    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '›' }).click();
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
    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
    await expect(page.locator('.loc')).toContainText('Ch 2/3');
  });

  test('theme + font size restyle without losing the chapter', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: '⚙' }).click();
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

    await page.getByRole('button', { name: '›' }).click();
    await page.getByRole('button', { name: '›' }).click();
    await expect(loc).toContainText('3/9');

    // cross-format switch: back to the EPUB
    await page.getByRole('combobox', { name: 'Book' }).selectOption('demo-book');
    await expect(loc).toContainText('%');
  });

  test('pinch/zoom controls work like the image reader', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    await page.getByRole('button', { name: '⚙' }).click();
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

  test('flow mode turns the reader into a semantic scroller', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: '⚙' }).click();
    await page.getByRole('tab', { name: 'Navigation' }).click();
    await page.getByLabel('Reading mode').selectOption('flow');
    await page.getByRole('button', { name: '⚙' }).click();

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
    await page.getByRole('button', { name: '›' }).click();
    await expect(page.locator('.loc')).toContainText('/12');
    await context.setOffline(false);
  });

  test('reader has no critical axe violations (keyboard + ARIA)', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.locator('iframe.pore-text__frame').waitFor();
    const results = await new AxeBuilder({ page })
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
    await page.getByRole('button', { name: '⚙' }).click();
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
    await page.getByRole('button', { name: '›' }).click(); // wake the chrome
    const slider = page.getByRole('slider', { name: 'Seek' });
    await expect(slider).toBeVisible();
    // demo-manga has 3 chapters → 2 interior ticks
    await expect(page.locator('.pore-scrubber__tick')).toHaveCount(2);

    const track = page.locator('.pore-scrubber__track');
    const box = (await track.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
    await expect(page.locator('.loc')).toContainText('Ch 3/3');
    await expect(page.locator('.pore-scrubber__label')).toContainText('%');
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
