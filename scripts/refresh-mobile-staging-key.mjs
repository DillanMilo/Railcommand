import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const STAGING_REF = 'rxuvchdqbzvovqijvfhx';
const STAGING_PROJECT_ID = 'prj_JWLbG1P1z06rCpN1bDI2DuugVpCy';
const ENV_FILE = '.env.mobile.local';

const link = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (link.projectId !== STAGING_PROJECT_ID) {
  throw new Error('Refusing to update an environment outside railcommand-mobile-staging');
}

const keys = JSON.parse(execFileSync('supabase', [
  'projects', 'api-keys', '--project-ref', STAGING_REF, '--output', 'json',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const publishable = keys.find((key) => key.type === 'publishable' && key.name === 'default');
if (!publishable?.api_key?.startsWith('sb_publishable_')) {
  throw new Error('The staging publishable key was not returned');
}

const current = readFileSync(ENV_FILE, 'utf8');
const next = current.replace(
  /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${publishable.api_key}`,
);
if (next === current && !current.includes(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${publishable.api_key}`)) {
  throw new Error(`${ENV_FILE} does not contain NEXT_PUBLIC_SUPABASE_ANON_KEY`);
}
writeFileSync(ENV_FILE, next, { mode: 0o600 });

for (const environment of ['development', 'preview', 'production']) {
  execFileSync('npx', [
    '--yes', 'vercel@59.1.4', 'env', 'update',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', environment,
    '--project', 'railcommand-mobile-staging', '--yes',
  ], {
    input: publishable.api_key,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

console.log(JSON.stringify({
  stagingProject: STAGING_REF,
  localEnvironmentUpdated: true,
  vercelEnvironmentsUpdated: ['development', 'preview', 'production'],
  keyType: 'publishable',
}, null, 2));
