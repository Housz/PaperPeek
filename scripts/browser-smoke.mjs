/** Installed MV3 extension smoke. Requires Playwright and an executor permitting Chromium. */
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const fixture = resolve(root, 'tests/browser/fixtures/reading-loop.pdf');
const bytes = await readFile(fixture);
const documentId = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const profile = await mkdtemp(resolve(tmpdir(), 'paperpeek-browser-'));
const output = process.env.PAPERPEEK_QA_OUTPUT || resolve(tmpdir(), 'paperpeek-browser-results');
await mkdir(output, { recursive: true });
let context;
const results = { browser: '', mode: process.env.HEADED ? 'headed' : 'headless', checks: [], limitations: ['Synthetic PDFs only; no live provider; no human usability study.'] };
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: !process.env.HEADED,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  let aiRequests = 0;
  context.on('request', request => { if (/api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com/.test(request.url())) aiRequests++; });
  const sessionId = 'qa-synthetic-session';
  const tab = await worker.evaluate(() => chrome.tabs.create({ url: 'about:blank' }));
  assert.ok(Number.isInteger(tab.id));
  const page = context.pages().at(-1);
  await worker.evaluate(async ({ tabId, sessionId, documentId }) => {
    const session = { sessionId, documentId, workspaceTabId: tabId, readerTabId: tabId, sourceUrl: null, sourceTabUrl: 'https://example.org/synthetic-article' };
    const paper = { id: 'qa-paper', documentId, title: 'Synthetic fixture', sourceUrl: null, pages: [], totalPages: 12, truncated: false };
    const state = { version: 1, tabId, tabUrl: session.sourceTabUrl, selectedPdfUrl: null, candidates: [], scanPerformed: true, paper, digest: null, conversation: [], draft: '', view: 'overview' };
    await chrome.storage.session.set({ ['paperpeek.readingSession.v1.'+sessionId]: session, ['paperpeek.tabWorkspace.v1.'+tabId]: { version: 1, format: 'json', data: JSON.stringify(state) } });
  }, { tabId: tab.id, sessionId, documentId });
  await page.goto(`chrome-extension://${extensionId}/reader.html?session=${sessionId}`);
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.locator('.pdf-page canvas').first().waitFor();
  assert.equal(await page.locator('.pdf-page').count(), 12);
  results.browser = await page.evaluate(() => navigator.userAgent);
  results.checks.push('Installed service worker, bundled PDF.js worker, 12 PDF pages and canvas rendered');
  for (const target of [1,2,3,4,5,6,7,8,9,10,11,12]) {
    await page.locator('#pageNumber').fill(String(target));
    await page.locator('#pageNumber').press('Enter');
    await page.waitForFunction(n => Number(document.querySelector('#pageNumber').value) === n, target);
  }
  results.checks.push('12/12 physical page controls accepted');
  await page.locator('#zoomIn').click();
  await page.locator('.more summary').click();
  await page.locator('#rotate').click();
  await page.locator('.more summary').click();
  await page.locator('#findToggle').click();
  await page.locator('#findText').fill('Unique evidence');
  await page.locator('#findText').press('Enter');
  await page.screenshot({ path: resolve(output, 'reader.png'), fullPage: false });
  assert.equal(aiRequests, 0);
  results.checks.push('Page/zoom/rotation/search caused zero provider requests');
  // Ask is a draft action: selecting page text and activating it must not call AI.
  await page.locator('#pageNumber').fill('1'); await page.locator('#pageNumber').press('Enter');
  await page.locator('.pdf-page .textLayer span').first().waitFor();
  await page.evaluate(() => {
    const span = document.querySelector('.pdf-page .textLayer span');
    const range = document.createRange(); range.selectNodeContents(span);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await page.locator('#askSelection').click();
  assert.equal(aiRequests, 0);
  results.checks.push('Selection Ask caused zero provider requests');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#selectionActions').isVisible(), false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: resolve(output, 'reader-dark.png'), fullPage: false });
  results.checks.push('Escape hides selection tools; dark/high-DPI screenshots captured');
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  await writeFile(resolve(output, 'failure.txt'), String(error));
  console.error(error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
