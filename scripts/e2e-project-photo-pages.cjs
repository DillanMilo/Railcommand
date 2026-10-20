/* eslint-disable @typescript-eslint/no-require-imports */
// Browser contract fixture: real gallery, hook, controls, upload preparation and
// styles; synthetic session, API rows and upload action. No live records are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const projectA = '10000000-0000-4000-8000-000000000001';
const projectB = '10000000-0000-4000-8000-000000000002';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
const cursor = (photo) => ({ createdAt: photo.created_at, id: photo.id });
const rows = (projectId) => Array.from({ length: 42 }, (_, index) => ({
  id: `30000000-0000-4000-8000-${String(42 - index).padStart(12, '0')}`,
  project_id: projectId, entity_id: projectId, entity_type: 'project_photo',
  file_name: `${projectId === projectA ? 'Project A' : 'Project B'} photo ${42 - index}.jpg`,
  file_url: '/pixel.png', signed_url: '/pixel.png', thumbnail_url: '/pixel.png',
  file_type: 'image/jpeg', file_size: 128, photo_category: index < 14 ? 'thermal' : 'standard',
  uploaded_by: 'fixture-user', created_at: '2026-10-20T12:00:00.123456+00:00',
  captured_at: null, geo_lat: null, geo_lng: null,
}));

async function main() {
  const fixtures = {
    '@/components/providers/ProjectProvider': `import {createContext,useContext} from 'react'; export const FixtureProvider=createContext({}); export const useProject=()=>useContext(FixtureProvider);`,
    '@/hooks/usePermissions': 'export const usePermissions=()=>({can:()=>true});',
    '@/lib/actions/project-photo-upload': `export const uploadProjectPhoto=async()=>({success:false,error:'Fixture upload interrupted. Retry is preserved.'});`,
    '@/lib/actions/attachments': 'export const deleteAttachment=async()=>({success:true});',
    'next/link': `import React from 'react'; export default function Link(props){return React.createElement('a',props);}`,
  };
  const compiled = await build({
    stdin: { contents: `import React,{Suspense,useMemo,useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import PhotosPage from './src/app/(app)/projects/[id]/photos/page';
      import {FixtureProvider} from '@/components/providers/ProjectProvider';
      function App(){const [session,setSession]=useState({currentUserId:'fixture-user',projectId:'${projectA}',isDemo:false});
        window.fixtureSession=(currentUserId,projectId)=>setSession({currentUserId,projectId,isDemo:false});
        const params=useMemo(()=>Promise.resolve({id:session.projectId}),[session.projectId]);
        const searchParams=useMemo(()=>Promise.resolve({}),[]);
        return <FixtureProvider.Provider value={session}><Suspense fallback="Opening photos…"><PhotosPage params={params} searchParams={searchParams}/></Suspense></FixtureProvider.Provider>;}
      createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'synthetic-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => args.path in fixtures ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: fixtures[args.path], resolveDir: root, loader: 'tsx' }));
    } }],
  });
  const cssDirectory = path.join(root, '.next/static/css');
  const css = fs.readdirSync(cssDirectory).filter((name) => name.endsWith('.css')).map((name) => fs.readFileSync(path.join(cssDirectory, name), 'utf8')).join('\n');
  const calls = [];
  let failure = 0;
  let hold = false;
  let release;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture');
    if (url.pathname === '/app.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(compiled.outputFiles[0].contents); return; }
    if (url.pathname === '/app.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); return; }
    if (url.pathname === '/pixel.png') { response.setHeader('Content-Type', 'image/png'); response.end(pixel); return; }
    if (url.pathname.startsWith('/api/workspace/')) {
      calls.push(url);
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'private, no-store');
      if (failure) { response.statusCode = failure; failure = 0; response.end(JSON.stringify({ error: 'Fixture read failed. Please retry.' })); return; }
      assert.equal(url.searchParams.get('page'), 'cursor');
      const projectId = url.pathname.split('/')[4];
      let data = rows(projectId);
      const category = url.searchParams.get('category');
      if (category !== 'all') data = data.filter((photo) => photo.photo_category === category);
      const after = url.searchParams.get('cursor');
      if (after) { const value = JSON.parse(after); data = data.filter((photo) => photo.created_at < value.createdAt || (photo.created_at === value.createdAt && photo.id < value.id)); }
      const page = data.slice(0, 12);
      const deliver = () => response.end(JSON.stringify({ data: page, nextCursor: data.length > 12 ? cursor(page.at(-1)) : null }));
      if (hold) { hold = false; release = deliver; } else deliver();
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="margin:0;padding:16px"><main id="root"></main><script src="/app.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [engine, width] of [[chromium, 1440], [chromium, 360], [webkit, 390]]) {
      const browser = await engine.launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('dialog', (dialog) => dialog.accept());
        await page.goto(baseUrl);
        const thumbnails = page.locator('button img');
        await thumbnails.nth(11).waitFor();
        assert.equal(await thumbnails.count(), 12);
        await page.evaluate((id) => window.fixtureSession('', id), projectA);
        await page.getByText('Opening project photos…', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Choose a saved photo').count(), 0, 'do not accept input before account identity is ready');
        await page.evaluate((id) => window.fixtureSession('fixture-user', id), projectA);
        await thumbnails.nth(11).waitFor();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('Page 2', { exact: true }).waitFor();
        await page.getByAltText('Project A photo 30.jpg', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Thermal', exact: true }).click();
        await page.getByAltText('Project A photo 42.jpg', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByAltText('Project A photo 29.jpg', { exact: true }).waitFor();
        assert.equal(await thumbnails.count(), 2);
        assert.ok(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled());
        await page.getByRole('button', { name: 'All', exact: true }).click();
        await thumbnails.nth(11).waitFor();

        // Actual upload preparation retains its candidate after a failed action.
        await page.getByLabel('Choose a saved photo').setInputFiles({ name: 'retained.png', mimeType: 'image/png', buffer: pixel });
        await page.getByRole('button', { name: 'Retry upload', exact: true }).waitFor();
        const input = await page.getByLabel('Choose a saved photo').elementHandle();
        failure = 503;
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('Fixture read failed. Please retry.', { exact: true }).waitFor();
        assert.ok(await input.evaluate((element) => element.isConnected), 'loading/error must not unmount upload controls');
        assert.ok(await page.getByRole('button', { name: 'Retry upload', exact: true }).isVisible());
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await thumbnails.nth(11).waitFor();

        await context.setOffline(true);
        await page.getByText(/Photo browsing needs a connection/).waitFor();
        assert.ok(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled());
        assert.ok(await page.getByRole('button', { name: 'Retry upload', exact: true }).isVisible());
        await context.setOffline(false);
        await page.getByRole('button', { name: 'Next', exact: true }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((button) => button.textContent === 'Next')?.disabled);
        assert.ok(await page.getByRole('button', { name: 'Retry upload', exact: true }).isVisible());

        // An old in-flight page cannot populate a different account/project.
        hold = true; release = undefined;
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await new Promise((resolve, reject) => {
          const deadline = Date.now() + 5000;
          const check = () => release ? resolve() : Date.now() > deadline ? reject(new Error('Delayed page request did not arrive')) : setTimeout(check, 10);
          check();
        });
        await page.evaluate((id) => window.fixtureSession('different-user', id), projectB);
        await page.getByAltText('Project B photo 42.jpg', { exact: true }).waitFor();
        release();
        assert.equal(await page.getByAltText(/Project A photo/).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Retry upload', exact: true }).count(), 0, 'account switch clears the prior account UI');

        const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(layout.scroll <= layout.width + 1, `horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
        assert.deepEqual(errors, []);
        assert.ok(calls.every((url) => url.searchParams.get('page') === 'cursor'));
        if (process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR, `photos-${engine.name()}-${width}.png`), fullPage: true });
        }
        console.log(`${engine.name()} ${width}px: pagination, filters, retained upload, failed read, offline/reconnect, account/project isolation and layout passed`);
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
