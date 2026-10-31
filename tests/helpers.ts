import { expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const STORAGE_KEY = 'tina.db.v1';
/** Where the app saved its data and Claude key before it was renamed. */
export const OLD_STORAGE_KEY = 'macro-lens.db.v1';
export const OLD_KEY_STORAGE = 'macro-lens.anthropic-key';
export const API_URL = 'https://api.anthropic.com/v1/messages';

/** Open the app fresh, with nothing saved, and collect any error it throws. */
export async function openFresh(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('nav.tabs');
  return errors;
}

/** Open the app with these localStorage values already saved. */
async function openWithStorage(page: Page, values: Record<string, string>): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, values);
  await page.reload();
  await page.waitForSelector('nav.tabs');
  return errors;
}

const readBackup = (backupPath: string): string =>
  readFileSync(new URL(backupPath, import.meta.url), 'utf8');

/** Open the app with a backup file's contents already saved. */
export const openWith = (page: Page, backupPath: string): Promise<string[]> =>
  openWithStorage(page, { [STORAGE_KEY]: readBackup(backupPath) });

/** Open the app with a backup and a Claude key saved under the app's old names. */
export const openWithOldNames = (page: Page, backupPath: string): Promise<string[]> =>
  openWithStorage(page, {
    [OLD_STORAGE_KEY]: readBackup(backupPath),
    [OLD_KEY_STORAGE]: 'sk-ant-test-0000000000',
  });

/** A real tap (touch events), then a moment for the screen to update. */
export async function tap(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  await element.tap();
  await page.waitForTimeout(100);
}

/** Save a (fake) Claude key under Targets. */
export async function setKey(page: Page): Promise<void> {
  await tap(page, '[data-tab="settings"]');
  await page.locator('#claudeKey').fill('sk-ant-test-0000000000');
  await tap(page, '[data-act="saveclaude"]');
}

/** Answer Claude API calls with this JSON (as the model's text), recording requests. */
export async function fakeClaude(
  page: Page,
  answer: unknown,
  status = 200,
): Promise<Array<{ headers: Record<string, string>; body: Record<string, unknown> }>> {
  const calls: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
  await page.route(API_URL, async (route: Route) => {
    const request = route.request();
    calls.push({ headers: request.headers(), body: request.postDataJSON() });
    if (status !== 200) {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'nope' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        content: [{ type: 'text', text: '```json\n' + JSON.stringify(answer) + '\n```' }],
        stop_reason: 'end_turn',
      }),
    });
  });
  return calls;
}

/** Everything saved, as the app sees it. */
export async function saved(page: Page): Promise<Record<string, Record<string, unknown>>> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').collections ?? {},
    STORAGE_KEY,
  );
}

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([]);
}

/** A tiny PNG to "photograph". */
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
