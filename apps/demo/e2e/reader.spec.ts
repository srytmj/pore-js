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
});
