import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import {
  STORE_STORIES,
  STORE_TARGETS,
  expectedFileName,
  validateStoreImage,
} from './store-media.mjs';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    story: { type: 'string' },
    device: { type: 'string' },
    replace: { type: 'boolean', default: false },
  },
});

function required(name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'pipe', ...options });
  if (result.status !== 0) {
    const detail = result.stderr?.toString().trim() || result.stdout?.toString().trim();
    throw new Error(`${command} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

const target = required('target');
const storySlug = required('story');
const device = required('device');
const definition = STORE_TARGETS[target];
if (!definition) throw new Error(`--target must be one of: ${Object.keys(STORE_TARGETS).join(', ')}`);
const story = STORE_STORIES.find((candidate) => candidate.slug === storySlug);
if (!story) throw new Error(`--story must be one of: ${STORE_STORIES.map(({ slug }) => slug).join(', ')}`);

const outputDirectory = resolve('docs/mobile/store-assets/screenshots', definition.directory);
mkdirSync(outputDirectory, { recursive: true });
const outputPath = join(outputDirectory, expectedFileName(target, story));
if (existsSync(outputPath) && !values.replace) {
  throw new Error(`${outputPath} already exists; inspect it or pass --replace intentionally`);
}

if (target.startsWith('apple-')) {
  run('xcrun', [
    'simctl', 'status_bar', device, 'override',
    '--time', '9:41',
    '--batteryState', 'charged',
    '--batteryLevel', '100',
    '--wifiBars', '3',
    '--cellularBars', '4',
  ]);
  run('xcrun', ['simctl', 'io', device, 'screenshot', '--type=png', outputPath]);
} else {
  const temporaryPng = join(tmpdir(), `railcommand-store-${process.pid}.png`);
  const screenshot = run('adb', ['-s', device, 'exec-out', 'screencap', '-p']);
  writeFileSync(temporaryPng, screenshot.stdout);
  try {
    run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', temporaryPng, '--out', outputPath]);
  } finally {
    unlinkSync(temporaryPng);
  }
}

const image = validateStoreImage(outputPath, target);
console.log(JSON.stringify({
  target,
  story: story.label,
  file: outputPath,
  dimensions: image.dimensions,
  format: image.format,
}, null, 2));
