import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const validated = validateMobileEnvironment(process.env);
const names = {
  development: 'RailCommand Development',
  staging: 'RailCommand Staging',
  production: 'RailCommand',
};
const mobilePackage = JSON.parse(
  readFileSync(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'),
);
const appVersion = process.env.MOBILE_APP_VERSION?.trim() || mobilePackage.version;
const buildNumber = process.env.MOBILE_BUILD_NUMBER?.trim() || '200001';
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) {
  throw new Error('MOBILE_APP_VERSION must use semantic major.minor.patch format');
}
if (!/^[1-9]\d*$/.test(buildNumber)) {
  throw new Error('MOBILE_BUILD_NUMBER must be a positive integer');
}

const result = spawnSync(
  'xcodebuild',
  [
    '-project', 'apps/mobile/ios/App/App.xcodeproj',
    '-scheme', 'App',
    '-sdk', 'iphonesimulator',
    '-destination', 'generic/platform=iOS Simulator',
    `RAILCOMMAND_APP_BUNDLE_IDENTIFIER=${validated.appId}`,
    `MARKETING_VERSION=${appVersion}`,
    `CURRENT_PROJECT_VERSION=${buildNumber}`,
    `MOBILE_DISPLAY_NAME=${names[validated.profile]}`,
    'CODE_SIGNING_ALLOWED=NO',
    'build',
  ],
  { env: process.env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
