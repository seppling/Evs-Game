import { expect, test } from '@playwright/test';

test('boots, starts a match, moves P1, finishes a timed round, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?time=3');
  expect(await page.evaluate(() => (window as any).__evs.mode())).toBe('title');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__evs.state()?.phase), { timeout: 5000 }).toBe('fight');
  const x0 = await page.evaluate(() => (window as any).__evs.state().fighters[0].x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => (window as any).__evs.state().fighters[0].x)).toBeGreaterThan(x0);
  await expect.poll(() => page.evaluate(() => (window as any).__evs.state().roundsPlayed), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});
