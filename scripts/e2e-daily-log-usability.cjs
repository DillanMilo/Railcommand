/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { stat, readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.RAILCOMMAND_E2E_BASE_URL || 'http://localhost:3004';
const fixturePath = path.resolve(__dirname, '../public/IMG_0936.jpg');
const pdfOutputPath = process.env.RAILCOMMAND_E2E_PDF_PATH || '/tmp/railcommand-daily-log-e2e.pdf';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 39.7392, longitude: -104.9903 },
    permissions: ['geolocation'],
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Array.isArray(data?.files) && data.files.length > 0,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        const file = data.files?.[0];
        window.__railcommandSharedPdf = {
          title: data.title,
          fileName: file?.name,
          fileType: file?.type,
          fileSize: file?.size,
        };
      },
    });
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    const demoSessionResponse = page.waitForResponse((response) =>
      response.url().includes('/api/demo/local-session') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Try demo project' }).click();
    assert.equal((await demoSessionResponse).status(), 200, 'demo session should be created');
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });

    await page.goto(`${baseUrl}/projects/proj-001/daily-logs/new`, {
      waitUntil: 'networkidle',
    });

    await page.getByRole('heading', { name: 'New Daily Log' }).waitFor();
    await page.getByText('Work Performed', { exact: true }).waitFor();
    await page.getByText('No personnel counts recorded.').waitFor();
    await page.getByText('No equipment counts recorded.').waitFor();
    await page.getByText('No measured quantities recorded.').waitFor();
    await page.getByText('Use photos already in RailCommand', { exact: true }).waitFor();

    const mobileLayout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1,
      `mobile page overflows horizontally: ${JSON.stringify(mobileLayout)}`
    );

    const workDescription = 'Road Builders had a concrete crew on site placing concrete at Track 805 and a demolition crew at the Flip Area breaking out damaged concrete.';
    await page.getByPlaceholder(/Road Builders had a concrete crew/).fill(workDescription);

    await page.getByRole('button', { name: 'Add Personnel' }).click();
    const roleInput = page.getByPlaceholder('e.g. Concrete crew');
    await roleInput.fill('Concrete placement crew');
    assert.equal(await roleInput.inputValue(), 'Concrete placement crew');
    await page.getByRole('button', { name: 'Remove personnel row' }).click();
    await page.getByText('No personnel counts recorded.').waitFor();

    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(fixturePath);
    await page.getByText(/1 \/ 20 photos attached/).waitFor({ timeout: 15000 });

    await page.getByRole('button', { name: 'Submit Log' }).click();
    await page.getByText('Daily log created').waitFor();
    await page.waitForURL('**/projects/proj-001/daily-logs', { timeout: 10000 });

    // The newly dated report is sorted first; seed counts can differ across
    // branches, so follow the rendered identifier instead of hard-coding it.
    const createdLogLink = page.locator('a[href^="/projects/proj-001/daily-logs/dl-"]').first();
    await createdLogLink.waitFor({ timeout: 10000 });
    assert.ok(await createdLogLink.count(), 'created daily log detail link was not rendered');
    const createdLogHref = await createdLogLink.getAttribute('href');
    assert.ok(createdLogHref, 'created daily log link should have an href');
    await createdLogLink.first().click();
    await page.waitForURL(`**${createdLogHref}`);
    await page.getByText(workDescription).waitFor();
    await page.getByText('Personnel', { exact: true }).waitFor({ state: 'detached' }).catch(() => {});
    await page.getByText('Equipment', { exact: true }).waitFor({ state: 'detached' }).catch(() => {});
    await page.locator('img[alt="IMG_0936.jpg"]').waitFor();
    const imageDiagnostic = await page.locator('img[alt="IMG_0936.jpg"]').evaluate(async (image) => {
      try {
        const response = await fetch(image.src, { cache: 'no-store' });
        const blob = await response.blob();
        return { src: image.src, ok: response.ok, type: blob.type, size: blob.size };
      } catch (error) {
        return { src: image.src, error: error instanceof Error ? error.message : String(error) };
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    assert.ok(downloadPath, 'PDF download did not produce a local file');
    await download.saveAs(pdfOutputPath);
    const pdfStats = await stat(pdfOutputPath);
    const pdfHeader = (await readFile(pdfOutputPath)).subarray(0, 4).toString();
    assert.equal(pdfHeader, '%PDF');
    assert.ok(pdfStats.size > 20_000, `expected photo-bearing PDF, received ${pdfStats.size} bytes; image diagnostic: ${JSON.stringify(imageDiagnostic)}`);

    await page.getByRole('button', { name: 'Share PDF' }).click();
    await page.waitForFunction(() => Boolean(window.__railcommandSharedPdf));
    const shared = await page.evaluate(() => window.__railcommandSharedPdf);
    assert.equal(shared.fileType, 'application/pdf');
    assert.match(shared.fileName, /^daily-log-.*\.pdf$/);
    assert.ok(shared.fileSize > 20_000, `shared PDF was unexpectedly small: ${shared.fileSize}`);

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('\n')}`);
    assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join('\n')}`);

    console.log(JSON.stringify({
      status: 'passed',
      viewport: mobileLayout,
      workDescription,
      pdfBytes: pdfStats.size,
      pdfOutputPath,
      sharedPdf: shared,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
