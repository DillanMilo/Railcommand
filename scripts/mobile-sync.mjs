import { spawnSync } from 'node:child_process';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

validateMobileEnvironment(process.env);

const platform = process.argv[2];
if (platform && platform !== 'ios' && platform !== 'android') {
  throw new Error('Mobile sync platform must be ios or android');
}

const build = spawnSync('node', ['scripts/mobile-build.mjs'], {
  env: process.env,
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const syncArgs = ['run', 'cap:sync', '--workspace', '@railcommand/mobile'];
if (platform) syncArgs.push('--', platform);
const sync = spawnSync('npm', syncArgs, {
  env: process.env,
  stdio: 'inherit',
});
if (sync.error) throw sync.error;
process.exitCode = sync.status ?? 1;
