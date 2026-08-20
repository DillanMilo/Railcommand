import { spawnSync } from 'node:child_process';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

validateMobileEnvironment(process.env);

const env = {
  ...process.env,
  VITE_MOBILE_APP_ID: process.env.MOBILE_APP_ID,
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
