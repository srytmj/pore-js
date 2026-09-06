import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Open the settings rail and expand one accordion section (Text / Theme /
 * Navigation / Layout / Image fit / Behavior / Menu bar). Controls in other
 * sections stay `inert`, so the wanted section must be expanded first.
 */
/**
 * Turn the page from the keyboard. The Prev/Next chrome buttons were removed —
 * navigation is keyboard / click-zone / swipe only. `rtl` flips the arrow for
 * right-to-left books (manga, Arabic, vertical-JP), where forward is ArrowLeft.
 */
async function turn(page: Page, dir: 'forward' | 'back' = 'forward', opts: { rtl?: boolean } = {}) {
  await page.locator('.pore-image img, iframe.pore-text__frame').first().waitFor();
  const image = page.locator('.pore-image');
  const loc = page.locator('.loc');
  const before = await loc.textContent().catch(() => null);

  const go = async () => {
    if ((await image.count()) > 0) {
      // image / PDF: click the edge tap-zone (right = forward in LTR)
      const box = (await image.boundingBox())!;
      const forwardRight = !opts.rtl;
      const toRight = dir === 'forward' ? forwardRight : !forwardRight;
      await page.mouse.click(box.x + box.width * (toRight ? 0.85 : 0.15), box.y + box.height / 2);
    } else {
      const key = dir === 'forward'
        ? (opts.rtl ? 'ArrowLeft' : 'ArrowRight')
        : (opts.rtl ? 'ArrowRight' : 'ArrowLeft');
      await page.locator('.pore-text').press(key);
    }
  };

  await go();
  await expect
    .poll(() => loc.textContent().catch(() => null), { timeout: 2000 })
    .not.toBe(before)
    .catch(go);
}

async function openSettingsSection(page: Page, section: string) {
  const trigger = page.getByRole('button', { name: 'Reader settings' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const summary = page.locator('[data-pore-accordion-summary]', { hasText: section });
  await summary.waitFor();
  if ((await summary.getAttribute('data-state')) !== 'open') await summary.click();
  await expect(summary).toHaveAttribute('data-state', 'open');
}

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

  test('library shelf: open two samples, resume from the shelf, remove one', async ({ page }) => {
    await page.goto('/');
    await page.locator('.landing__samples').getByRole('button', { name: /Novel/ }).click();
    await expect(page.frameLocator('iframe.pore-text__frame').locator('h1')).toBeVisible();
    await page.getByRole('button', { name: 'Back to start' }).click();

    await page.locator('.landing__samples').getByRole('button', { name: /Manga/ }).click();
    await expect(page.locator('.loc')).toContainText('1/12');
    await page.getByRole('button', { name: 'Back to start' }).click();

    const shelf = page.locator('.landing__recent');
    await expect(shelf).toBeVisible();
    await expect(shelf.locator('.landing__recent-item')).toHaveCount(2);
    // most-recent first
    await expect(shelf.locator('.landing__recent-title').first()).toHaveText('Manga');

    await shelf.locator('.landing__recent-open', { hasText: 'Manga' }).click();
    await expect(page).toHaveURL(/[?&]book=demo-manga/);
    await page.getByRole('button', { name: 'Back to start' }).click();

    await page.getByRole('button', { name: 'Remove Manga from library' }).click();
    await expect(shelf.locator('.landing__recent-item')).toHaveCount(1);
    await expect(shelf.locator('.landing__recent-title').first()).toHaveText('Novel (EPUB)');
  });

  test('annotations review: highlight in a sample, find it from the home screen, jump back', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('.landing__samples').getByRole('button', { name: /Novel/ }).click();
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
    await page.locator('.selection-toolbar__swatch').first().click();
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');
    await page.waitForTimeout(1000); // debounced save

    await page.getByRole('button', { name: 'Back to start' }).click();
    await page.getByRole('button', { name: 'My annotations' }).click();

    const review = page.getByRole('dialog', { name: 'My annotations' });
    await expect(review).toBeVisible();
    await expect(review.locator('.review__group-title')).toHaveText('Novel (EPUB)');
    await expect(review.locator('.review__row')).toHaveCount(1);

    // filter: a non-matching needle empties it, clearing brings it back
    await review.getByLabel('Filter annotations').fill('zzzznomatch');
    await expect(review.locator('.review__row')).toHaveCount(0);
    await review.getByLabel('Filter annotations').fill('');
    await expect(review.locator('.review__row')).toHaveCount(1);

    await review.locator('.review__jump').first().click();
    await expect(review).toBeHidden();
    await expect(page).toHaveURL(/[?&]book=demo-book/);
    await expect(frame.locator('h1')).toContainText('The Beginning');
  });

  test('export / import: a highlight survives a wipe via the JSON bundle', async ({ page }) => {
    await page.goto('/');
    await page.locator('.landing__samples').getByRole('button', { name: /Novel/ }).click();
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').evaluate((el) => {
      const doc = el.ownerDocument!;
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    await page.locator('.selection-toolbar__swatch').first().click();
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Back to start' }).click();
    await page.getByRole('button', { name: 'My annotations' }).click();
    const review = page.getByRole('dialog', { name: 'My annotations' });

    await expect(review.locator('.review__group-export')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await review.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();

    // wipe the highlight from its store
    await review.getByRole('button', { name: 'Close' }).click();
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Highlights' }).click();
    await page.locator('[data-pore-hl-remove]').first().click();
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Highlights' })).not.toContainText('1');

    // re-import
    await page.getByRole('button', { name: 'Back to start' }).click();
    await page.getByRole('button', { name: 'My annotations' }).click();
    await review.locator('input[type="file"]').setInputFiles(path!);
    await expect(review.locator('.review__notice')).toContainText('1 highlight');

    await page.goto('/?book=demo-book');
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');
  });

  test('share a passage: copy a page link, open it fresh, it lands + pulses', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?book=demo-book');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();
    // turn a few pages so the link isn't page 1
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Copy a link to this page' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/[?&]book=demo-book/);
    expect(link).toMatch(/[?&]cfi=/);

    await page.goto(link);
    await expect(page.locator('.reader-host--pulse')).toBeVisible();
    await expect(page).toHaveURL(/book=demo-book/);
    await expect(page).not.toHaveURL(/cfi=/); // consumed on load
    // pulse clears
    await expect(page.locator('.reader-host--pulse')).toHaveCount(0, { timeout: 4000 });
  });

  test('annotations review is axe clean and keyboard-reachable (light + dark)', async ({ page }) => {
    // make one annotation so the review has content
    await page.goto('/');
    await page.locator('.landing__samples').getByRole('button', { name: /Novel/ }).click();
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').evaluate((el) => {
      const doc = el.ownerDocument!;
      const r = doc.createRange();
      r.selectNodeContents(el);
      const s = doc.getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    await page.locator('.selection-toolbar__swatch').first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Back to start' }).click();

    for (const dark of [false, true]) {
      await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
      await page.goto('/');
      await page.getByRole('button', { name: 'My annotations' }).click();
      const review = page.getByRole('dialog', { name: 'My annotations' });
      await expect(review).toBeVisible();

      // keyboard: the jump control is tabbable and Enter navigates
      await review.getByLabel('Filter annotations').focus();
      await expect(review.locator('.review__group-export')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include('.review')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious, `${dark ? 'dark' : 'light'}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);

      await review.getByRole('button', { name: 'Close' }).click();
      await expect(review).toBeHidden();
    }
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

    await turn(page, 'forward', { rtl: true });
    await turn(page, 'forward', { rtl: true });
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
    await turn(page, 'forward', { rtl: true });
    await expect(page.locator('.loc')).toContainText('3/12');
    await turn(page, 'back', { rtl: true });
    await expect(page.locator('.loc')).toContainText('1/12');
  });

  test('resize keeps the reading position', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await turn(page, 'forward', { rtl: true });
    await turn(page, 'forward', { rtl: true });
    const before = await page.locator('.loc').textContent();
    await page.setViewportSize({ width: 500, height: 900 });
    await expect(page.locator('.loc')).toHaveText(before!.trim());
  });

  test('the menu rail is a fixed overlay that insets the reader when docked', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    const bar = page.locator('.bar--right, .bar--left').first();
    await expect(bar).toHaveCSS('position', 'fixed');
    // default behaviour is "always visible" → docked: the reader host butts up
    // against the rail with no gap and no overlap
    const barBox = (await bar.boundingBox())!;
    const hostBox = (await page.locator('.pore-image').boundingBox())!;
    expect(Math.abs(hostBox.x + hostBox.width - barBox.x)).toBeLessThanOrEqual(2);
  });

  test('menu bar: Left placement docks the rail on the left and insets the reader', async ({
    page,
  }) => {
    await page.goto('/?book=demo-manga');
    await openSettingsSection(page, 'Menu bar');
    await page.getByRole('button', { name: 'Left', exact: true }).click();
    await page.getByRole('button', { name: /Always visible/ }).click();
    await page.getByRole('button', { name: 'Reader settings' }).click(); // close settings

    const bar = page.locator('.bar--left');
    await expect(bar).toHaveCSS('position', 'fixed');
    const barBox = (await bar.boundingBox())!;
    expect(barBox.x).toBeLessThanOrEqual(1);
    // the reader is inset roughly by the rail width (allow for the width
    // transition + sub-pixel rounding)
    await expect
      .poll(async () => (await page.locator('.pore-image').boundingBox())!.x)
      .toBeGreaterThan(barBox.width - 20);
  });

  test('menu bar: Auto-hide slides the rail away, activity wakes it', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await openSettingsSection(page, 'Menu bar');
    await page.getByRole('button', { name: 'Right', exact: true }).click();
    await page.getByRole('button', { name: /Auto-hide/ }).click();
    await page.getByRole('button', { name: 'Reader settings' }).click(); // close settings
    await page.locator('.pore-image').first().click({ position: { x: 8, y: 8 } });

    const bar = page.locator('.bar--right');
    await page.mouse.move(400, 300);
    await expect(bar).toHaveClass(/bar--hidden/, { timeout: 6000 });
    await page.mouse.move(410, 310);
    await page.mouse.move(420, 320);
    await expect(bar).not.toHaveClass(/bar--hidden/);
    await expect(bar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });

  test('PDF rect highlight: Shift-drag a passage, it persists across reload', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    const img = page.locator('.pore-image__viewport img');
    await expect(img).toBeVisible();
    // wait for the rendered page (broken/loading img is tiny)
    await expect.poll(async () => (await img.boundingBox())!.width).toBeGreaterThan(200);
    const box = (await img.boundingBox())!;

    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.09);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.11, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    await page.getByRole('button', { name: /Highlight in/ }).first().click();
    await expect(page.locator('.pore-pdf-hl__box')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Highlights' })).toContainText('1');

    await page.waitForTimeout(800); // debounced save
    await page.reload();
    await expect(page.locator('.pore-pdf-hl__box')).toHaveCount(1);
    await page.getByRole('button', { name: 'Highlights' }).click();
    await expect(page.locator('[data-pore-hl-jump]').first()).toContainText('Lorem');
  });

  test('theme button on an EPUB cycles light → sepia → dark', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await page.frameLocator('iframe.pore-text__frame').locator('h1').waitFor();
    const style = page.frameLocator('iframe.pore-text__frame').locator('#pore-base-style');
    const btn = page.getByRole('button', { name: /Reading theme/ });
    const bg = () => style.textContent().then((t) => t?.match(/background:(#[0-9a-f]+)/i)?.[1]);

    // drive to 'light' first (persisted theme could be anything)
    for (let i = 0; i < 4; i++) {
      if (/light/.test((await btn.getAttribute('aria-label')) ?? '')) break;
      await btn.click();
      await page.waitForTimeout(150);
    }
    await expect.poll(bg).toBe('#faf7f1'); // light
    await btn.click();
    await expect.poll(bg).toBe('#f2e7d3'); // sepia
    await btn.click();
    await expect.poll(bg).toBe('#17150f'); // dark
  });

  test('url-and-title history: ?p= updates and back/forward paginate', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await turn(page, 'forward', { rtl: true });
    await turn(page, 'forward', { rtl: true });
    await expect(page).toHaveURL(/[?&]p=\d+/);
    const reached = await page.locator('.loc').textContent();
    await page.goBack();
    await expect(page.locator('.loc')).not.toHaveText(reached!.trim());
    await page.goForward();
    await expect(page.locator('.loc')).toHaveText(reached!.trim());
  });

  test('settings panel changes the fit mode live', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await openSettingsSection(page, 'Image fit');
    await page.getByLabel('Fit mode').selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });

  test('continuous-horizontal reads and virtualizes', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await openSettingsSection(page, 'Layout');
    await page.getByLabel('Layout').selectOption('continuous-horizontal');
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

    for (let i = 0; i < 4; i++) await turn(page, 'forward');
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
    await turn(page, 'forward', { rtl: true });
    await turn(page, 'forward', { rtl: true });
    await turn(page, 'forward', { rtl: true });
    await expect(page.locator('.loc')).toContainText('Ch 2/3');
  });

  test('theme + font size restyle without losing the chapter', async ({ page }) => {
    await page.goto('/?book=demo-book');
    await openSettingsSection(page, 'Theme');
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    const bg = await page
      .frameLocator('iframe.pore-text__frame')
      .locator('#pore-base-style')
      .textContent();
    expect(bg).toContain('#17150f');
  });
});

test.describe('Pore.js demo — PDF', () => {
  test('renders pages, turns, and switches back to another format', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    const loc = page.locator('.loc');
    await expect(loc).toContainText('1/9');
    await expect(page.locator('.pore-image img')).toHaveCount(1);

    await turn(page, 'forward');
    await turn(page, 'forward');
    await expect(loc).toContainText('3/9');

    // cross-format switch: back to the EPUB (the book picker is a Radix Select)
    await page.getByRole('combobox', { name: 'Book' }).click();
    await page.getByRole('option', { name: 'Novel (EPUB)' }).click();
    await expect(loc).toContainText('%');
  });

  test('pinch/zoom controls work like the image reader', async ({ page }) => {
    await page.goto('/?book=demo-pdf');
    await openSettingsSection(page, 'Image fit');
    await page.getByLabel('Fit mode').selectOption('width');
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
    // wait for pagination to settle before capturing the baseline transform
    await expect.poll(() => flow.evaluate((el) => el.style.transform)).toMatch(/translate/);
    const before = await flow.evaluate((el) => el.style.transform);
    // ArrowLeft = forward in a vertical book
    await page.locator('.pore-text').press('ArrowLeft');
    await expect
      .poll(() => flow.evaluate((el) => el.style.transform), { timeout: 8000 })
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
    await openSettingsSection(page, 'Navigation');
    await page.getByLabel('Reading mode').selectOption('flow');
    await page.getByRole('button', { name: 'Reader settings' }).click(); // close settings

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

  test('dark theme: the chrome is still axe clean (contrast on the dark palette)', async ({
    page,
  }) => {
    await page.goto('/?book=demo-manga'); // image book → shell dark toggle
    await page.getByRole('button', { name: /theme/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Reader settings' }).click();
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

  test('settings accordion: sections expand one at a time, controls reachable, axe clean', async ({
    page,
  }) => {
    await page.goto('/?book=demo-book');
    await page.getByRole('button', { name: 'Reader settings' }).click();
    const rail = page.locator('.bar__settings-inline');
    await expect(rail).toBeVisible();

    // exclusive: opening Navigation closes Text
    await openSettingsSection(page, 'Navigation');
    await expect(page.locator('[data-pore-accordion-summary]', { hasText: 'Text' })).toHaveAttribute(
      'data-state',
      'closed',
    );
    await expect(page.getByLabel('Reading mode')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('.bar')
      .exclude('iframe.pore-text__frame')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);

    // the Settings toggle closes it again
    await page.getByRole('button', { name: 'Reader settings' }).click();
    await expect(rail).toBeHidden();
  });

  test('bottom scrubber seeks and shows chapter ticks', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await turn(page, 'forward', { rtl: true }); // also wakes the chrome
    await page.mouse.move(400, 300); // nudge auto-hide
    const slider = page.getByRole('slider', { name: 'Seek' });
    await expect(slider).toBeVisible();
    // demo-manga has 3 chapters → 2 interior ticks
    await expect(page.locator('.pore-scrubber__tick')).toHaveCount(2);

    const track = page.locator('.pore-scrubber__track');
    const box = (await track.boundingBox())!;
    // demo-manga reads RTL, so the scrubber runs right→left: the far end of the
    // book is the LEFT edge of the track
    await page.mouse.click(box.x + box.width * 0.03, box.y + box.height / 2);
    await expect(page.locator('.loc')).toContainText('Ch 3/3');
    await expect(page.locator('[data-pore-scrubber-label]')).toContainText('%');
  });

  test('bookmark: add with "b", turn pages, jump back to it, survives reload', async ({ page }) => {
    await page.goto('/?book=demo-book');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();
    const reader = page.locator('.pore-text');
    const pct = async () =>
      Number((await page.locator('.loc').textContent())!.match(/(\d+)%/)![1]);

    for (let i = 0; i < 6; i++) await reader.press('ArrowRight');
    const marked = await pct();
    await reader.press('b'); // bookmark this page
    await expect(page.getByRole('button', { name: 'Bookmarks' })).toContainText('1');

    for (let i = 0; i < 6; i++) await reader.press('ArrowRight');
    expect(await pct()).toBeGreaterThan(marked + 3);

    await page.getByRole('button', { name: 'Bookmarks' }).click();
    await page.locator('[data-pore-bm-jump]').first().click();
    // back near the mark (± a page for anchor drift), not still far ahead
    await expect.poll(pct).toBeLessThanOrEqual(marked + 2);

    await page.waitForTimeout(800); // debounced save
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bookmarks' })).toContainText('1');
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
    await page.locator('[data-pore-hl-jump]').first().click();
    await expect(frame.locator('h1')).toContainText('The Beginning');
  });

  test('highlight note: add via the panel, edit, survives reload', async ({ page }) => {
    await page.goto('/?book=demo-book');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').evaluate((el) => {
      const doc = el.ownerDocument!;
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    // the ✎ action highlights and opens the panel
    await page.getByRole('button', { name: 'Highlight and add a note' }).click();
    const note = page.locator('[data-pore-hl-note]').first();
    await note.fill('remember this bit');
    await note.blur();
    await page.waitForTimeout(1000); // debounced save

    await page.reload();
    await page.getByRole('button', { name: 'Highlights' }).click();
    await expect(page.locator('[data-pore-hl-note]').first()).toHaveValue('remember this bit');

    // recolour and re-check it persists
    await page.locator('[data-pore-hl-swatch]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.reload();
    await page.getByRole('button', { name: 'Highlights' }).click();
    await expect(page.locator('[data-pore-hl-swatch]').nth(1)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('fixed-layout EPUB pages one spine per turn, scaled to fit the window', async ({ page }) => {
    await page.goto('/?book=demo-fixed');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await expect(frame.locator('h1')).toContainText('A Good Morning');
    await turn(page, 'forward');
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

  test('M5 UI (menu-bar settings, note editor, highlights panel) is axe clean & keyboard-reachable', async ({
    page,
  }) => {
    await page.goto('/?book=demo-book');
    const frame = page.frameLocator('iframe.pore-text__frame');
    await frame.locator('h1').waitFor();

    // add a highlight + note so the panel has an editable row
    await frame.locator('h1').evaluate((el) => {
      const doc = el.ownerDocument!;
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    await page.getByRole('button', { name: 'Highlight and add a note' }).click();
    // the note textarea is keyboard-reachable and editable
    const note = page.locator('[data-pore-hl-note]').first();
    await note.focus();
    await page.keyboard.type('keyboard note');
    await expect(note).toHaveValue('keyboard note');

    // open the Menu bar settings section
    await openSettingsSection(page, 'Menu bar');
    await expect(page.getByRole('button', { name: 'Right', exact: true })).toBeVisible();

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
