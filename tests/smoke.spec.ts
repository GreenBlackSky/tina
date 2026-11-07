import { expect, test } from '@playwright/test';
import {
  expectNoErrors,
  fakeClaude,
  OLD_STORAGE_KEY,
  openFresh,
  openWith,
  openWithOldNames,
  PIXEL_PNG,
  saved,
  setKey,
  tap,
} from './helpers';

/* Every screen draws; logging by search, text, photo and label works end to
   end (with Claude's answers faked, so no key or money is needed). */

const SAMPLE = './sample-backup.json';
const TABS = ['today', 'meals', 'add', 'week', 'settings'];

test('every screen draws, empty and with data', async ({ page }) => {
  let errors = await openFresh(page);
  for (const tab of TABS) {
    await tap(page, `[data-tab="${tab}"]`);
    await expect(page.locator('#main')).not.toBeEmpty();
  }
  await expectNoErrors(errors);
  errors = await openWith(page, SAMPLE);
  for (const tab of TABS) {
    await tap(page, `[data-tab="${tab}"]`);
    await expect(page.locator('#main')).not.toBeEmpty();
  }
  await expectNoErrors(errors);
});

test('log a food from search', async ({ page }) => {
  const errors = await openFresh(page);
  await tap(page, '[data-tab="add"]');
  await tap(page, '[data-mode="search"]');
  await page.locator('#searchBox').fill('banana');
  await tap(page, '[data-act="pick"]');
  await expect(page.locator('.review')).toBeVisible();
  await page.locator('#g0').fill('118');
  await expect(page.locator('#totK')).toHaveText('105 kcal');
  await tap(page, '[data-act="commit"]');
  await expect(page.locator('.rs')).toContainText('105 of 2,000 eaten');
  await expectNoErrors(errors);
});

test('without a key, estimates explain how to turn them on', async ({ page }) => {
  const errors = await openFresh(page);
  await tap(page, '[data-tab="add"]');
  await expect(page.locator('.banner').first()).toContainText('Claude API key');
  await tap(page, '[data-mode="text"]');
  await page.locator('#textIn').fill('two eggs');
  await expect(page.locator('[data-act="run"]')).toBeDisabled();
  await expectNoErrors(errors);
});

test('a text estimate: matched foods and an estimate, then saved', async ({ page }) => {
  const errors = await openFresh(page);
  const calls = await fakeClaude(page, {
    title: 'Eggs on toast',
    items: [
      { name: 'fried egg', key: 'egg_fried', grams: 100, per100: null },
      { name: 'ajvar', key: null, grams: 30, per100: { kcal: 80, p: 1, c: 8, f: 5 } },
    ],
    comment: 'Ajvar amount is a guess.',
  });
  await setKey(page);
  await tap(page, '[data-tab="add"]');
  await tap(page, '[data-mode="text"]');
  await page.locator('#textIn').fill('two fried eggs with ajvar');
  await tap(page, '[data-act="run"]');
  await expect(page.locator('#titleIn')).toHaveValue('Eggs on toast');
  await expect(page.locator('.item .nm').first()).toContainText('Egg, fried');
  await expect(page.locator('.badge.est')).toHaveText('estimate');
  await expect(page.locator('.comment')).toHaveText('Ajvar amount is a guess.');

  expect(calls).toHaveLength(1);
  expect(calls[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(calls[0].headers['x-api-key']).toBe('sk-ant-test-0000000000');
  expect(calls[0].body.model).toBe('claude-sonnet-5-5');

  await tap(page, '[data-act="commit"]');
  await expect(page.locator('.erow')).toHaveCount(1);
  await expectNoErrors(errors);
});

test('a label photo becomes one of my foods', async ({ page }) => {
  const errors = await openFresh(page);
  const calls = await fakeClaude(page, {
    name: 'Protein yogurt',
    servingGrams: 150,
    per100: { kcal: 60, p: 10, c: 4, f: 0.2 },
    comment: '',
  });
  await setKey(page);
  await tap(page, '[data-tab="add"]');
  await tap(page, '[data-mode="label"]');
  await page
    .locator('#galIn')
    .setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PIXEL_PNG });
  await expect(page.locator('.drop img')).toBeVisible();
  await tap(page, '[data-act="run"]');
  await expect(page.locator('#g0')).toHaveValue('150');
  const content = (calls[0].body.messages as Array<{ content: Array<{ type: string }> }>)[0]
    .content;
  expect(content[0].type).toBe('image');
  await tap(page, '[data-act="commit"]');
  const foods = (await saved(page)).foods as Record<string, { name: string }>;
  expect(Object.values(foods).map((food) => food.name)).toEqual(['Protein yogurt']);
  await expectNoErrors(errors);
});

test('a refused key says so', async ({ page }) => {
  const errors = await openFresh(page);
  await fakeClaude(page, null, 401);
  await setKey(page);
  await tap(page, '[data-tab="add"]');
  await tap(page, '[data-mode="text"]');
  await page.locator('#textIn').fill('a banana');
  await tap(page, '[data-act="run"]');
  await expect(page.locator('.err')).toContainText('API key was refused');
  await expectNoErrors(errors);
});

test('saved meals: log, edit the entry, delete with two taps', async ({ page }) => {
  const errors = await openWith(page, SAMPLE);
  await tap(page, '[data-tab="meals"]');
  await tap(page, '.meal:has-text("Tofu rice bowl") [data-act="logmeal"]');
  await tap(page, '[data-act="scale"][data-f="0.5"]');
  await expect(page.locator('#g0')).toHaveValue('75');
  await tap(page, '[data-act="commit"]');
  await expect(page.locator('.erow')).toHaveCount(1);

  await page.locator('.erow summary').tap();
  await tap(page, '[data-act="editentry"]');
  await page.locator('#titleIn').fill('Half bowl');
  await tap(page, '[data-act="commit"]');
  await expect(page.locator('.erow .en b')).toHaveText('Half bowl');

  await page.locator('.erow summary').tap();
  await tap(page, '[data-act="delentry"]');
  await expect(page.locator('[data-act="delentry"]')).toHaveText('Tap again to delete');
  await tap(page, '[data-act="delentry"]');
  await expect(page.locator('.erow')).toHaveCount(0);
  await expectNoErrors(errors);
});

test('the calculator sets targets', async ({ page }) => {
  const errors = await openFresh(page);
  await tap(page, '[data-tab="settings"]');
  await page.locator('#pAge').fill('35');
  await page.locator('#pH').fill('178');
  await page.locator('#pW').fill('75');
  await expect(page.locator('.facts .cal .v')).toHaveText(/\d/);
  await expect(page.locator('ol.steps li')).toHaveCount(6);
  await tap(page, '[data-act="usecalc"]');
  const settings = (await saved(page)).settings as Record<
    string,
    { method: string; isSet: boolean }
  >;
  expect(settings.targets.method).toBe('calculated');
  await expect(page.locator('.banner:has-text("example targets")')).toHaveCount(0);
  await expectNoErrors(errors);
});

test('data and the Claude key saved as Macro Lens carry over', async ({ page }) => {
  const errors = await openWithOldNames(page, SAMPLE);
  await tap(page, '[data-tab="meals"]');
  await expect(page.locator('.meal')).toHaveCount(2);
  await tap(page, '[data-tab="settings"]');
  await expect(page.locator('[data-claude-status]')).toContainText('sk-ant-…0000');
  expect(await page.evaluate((key) => localStorage.getItem(key), OLD_STORAGE_KEY)).not.toBeNull();
  await expectNoErrors(errors);
});

test('a backup saves and restores', async ({ page }) => {
  const errors = await openWith(page, SAMPLE);
  await tap(page, '[data-tab="settings"]');
  const download = page.waitForEvent('download');
  await tap(page, '[data-export]');
  const file = await (await download).path();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await tap(page, '[data-tab="settings"]');
  await page.locator('input[type=file][accept*="json"]').setInputFiles(file);
  await tap(page, '[data-replace]');
  await tap(page, '[data-tab="meals"]');
  await expect(page.locator('.meal')).toHaveCount(2);
  await expectNoErrors(errors);
});

/* Signing in itself needs a real Google account, so it is tried by hand;
   this checks that Firebase loads and the app sees "signed out". */
test('Google sign-in is offered, signed out', async ({ page }) => {
  const errors = await openFresh(page);
  await expect(page.locator('[data-act="account"]')).toHaveText('Sign in');
  await tap(page, '[data-tab="settings"]');
  await expect(page.locator('[data-account]')).toHaveAttribute('data-account', 'signed-out');
  await expect(page.locator('[data-act="signin"]')).toBeEnabled();
  await expectNoErrors(errors);
});
