import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { inspectReviewerVideo } from './verify-reviewer-video.mjs';

const { values } = parseArgs({
  options: {
    device: { type: 'string' },
    duration: { type: 'string', default: '180' },
    output: {
      type: 'string',
      default: 'docs/mobile/private/reviewer-walkthroughs/railcommand-ios-reviewer-v1.0.0.mp4',
    },
    replace: { type: 'boolean', default: false },
  },
});

const device = values.device?.trim();
if (!device) throw new Error('Missing --device <booted simulator UDID>');

const durationSeconds = Number(values.duration);
if (!Number.isInteger(durationSeconds) || durationSeconds < 45 || durationSeconds > 240) {
  throw new Error('--duration must be an integer from 45 to 240 seconds');
}

const outputPath = resolve(values.output);
if (existsSync(outputPath) && !values.replace) {
  throw new Error(`${outputPath} already exists; inspect it or pass --replace intentionally`);
}

const list = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], { encoding: 'utf8' });
if (list.status !== 0) throw new Error(list.stderr.trim() || 'Could not inspect booted simulators');
const booted = Object.values(JSON.parse(list.stdout).devices).flat();
if (!booted.some(({ udid, state }) => udid === device && state === 'Booted')) {
  throw new Error(`Simulator ${device} is not booted`);
}

mkdirSync(dirname(outputPath), { recursive: true });
if (existsSync(outputPath)) unlinkSync(outputPath);

spawnSync('xcrun', [
  'simctl', 'status_bar', device, 'override',
  '--time', '9:41',
  '--batteryState', 'charged',
  '--batteryLevel', '100',
  '--wifiBars', '3',
  '--cellularBars', '4',
]);

console.log(JSON.stringify({
  status: 'recording',
  device,
  output: outputPath,
  durationSeconds,
  reminder: 'Begin authenticated with no password visible; use synthetic data only.',
}, null, 2));

const recorder = spawn(
  'xcrun',
  ['simctl', 'io', device, 'recordVideo', '--codec=h264', '--force', outputPath],
  { stdio: 'inherit' },
);

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  recorder.kill('SIGINT');
};

const timer = setTimeout(stop, durationSeconds * 1_000);
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

const exitCode = await new Promise((resolveExit, reject) => {
  recorder.once('error', reject);
  recorder.once('exit', (code) => resolveExit(code));
});
clearTimeout(timer);
if (exitCode !== 0) throw new Error(`Simulator recording exited with status ${exitCode}`);

console.log(JSON.stringify({
  status: 'recorded',
  ...inspectReviewerVideo(outputPath),
  manualReviewRequired: [
    'No password, token, precise coordinate, customer data, or debug control is visible',
    'One offline log and one photo persist through restart and synchronize exactly once',
    'Account deletion is demonstrated without submitting a request',
  ],
}, null, 2));
