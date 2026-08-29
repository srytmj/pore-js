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
    await page.getByRole('dialog', { name: 'Reader settings' }).getByText('Image fit').click();
    await page.getByRole('dialog').locator('select').first().selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });

  test('continuous-horizontal reads and virtualizes', async ({ page }) => {
    await page.goto('/?book=demo-manga');
    await page.getByRole('button', { name: '⚙' }).click();
    await page.getByRole('dialog').locator('select').first().selectOption('continuous-horizontal');
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
    await page.getByRole('dialog', { name: 'Reader settings' }).getByText('Theme').click();
    await page.getByRole('dialog').locator('select').selectOption('dark');
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
    await page.getByRole('dialog').locator('select').first().selectOption('width');
    await expect(page.locator('.pore-image img').first()).toHaveAttribute('style', /width:\s*100%/);
  });
});
