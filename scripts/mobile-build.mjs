import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const validated = validateMobileEnvironment(process.env);
const mobilePackage = JSON.parse(readFileSync(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'));
const appVersion = process.env.MOBILE_APP_VERSION?.trim() || mobilePackage.version;
const buildNumber = process.env.MOBILE_BUILD_NUMBER?.trim() || '200001';
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) {
  throw new Error('MOBILE_APP_VERSION must use semantic major.minor.patch format');
}
if (!/^[1-9]\d*$/.test(buildNumber)) {
  throw new Error('MOBILE_BUILD_NUMBER must be a positive integer');
}

const env = {
  ...process.env,
  VITE_ALLOW_PRODUCTION_BUILD: validated.profile === 'production' ? 'yes' : 'no',
  VITE_APP_VERSION: appVersion,
  VITE_MOBILE_APP_ID: process.env.MOBILE_APP_ID,
  VITE_BUILD_NUMBER: buildNumber,
  VITE_BUILD_PROFILE: validated.profile,
  VITE_EXPECTED_API_HOST: process.env.MOBILE_EXPECTED_APP_HOST,
  VITE_EXPECTED_SUPABASE_PROJECT_REF: process.env.MOBILE_EXPECTED_SUPABASE_PROJECT_REF,
  VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  VITE_API_BASE_URL: process.env.NEXT_PUBLIC_APP_URL,
};

const result = spawnSync('npm', ['run', 'build', '--workspace', '@railcommand/mobile'], {
  env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
