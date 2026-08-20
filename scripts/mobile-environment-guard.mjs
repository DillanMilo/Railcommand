const DEV_APP_ID = 'io.railcommand.app.dev';
const FORBIDDEN_CLIENT_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_DB_PASSWORD',
  'FIREBASE_ADMIN_CREDENTIALS',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'APNS_PRIVATE_KEY',
  'APP_STORE_CONNECT_API_PRIVATE_KEY',
];

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for mobile staging work`);
  return value;
}

function csv(value) {
  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseHttpsUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`);
  return url;
}

export function validateMobileEnvironment(env) {
  const exposedSecret = FORBIDDEN_CLIENT_SECRETS.find((name) => env[name]?.trim());
  if (exposedSecret) {
    throw new Error(`${exposedSecret} is forbidden in a mobile client environment`);
  }

  const profile = required(env, 'MOBILE_BUILD_PROFILE');
  if (!['development', 'staging'].includes(profile)) {
    throw new Error('MOBILE_BUILD_PROFILE must be development or staging');
  }

  const appId = required(env, 'MOBILE_APP_ID');
  const expectedAppId = required(env, 'MOBILE_EXPECTED_APP_ID');
  if (appId !== expectedAppId || appId !== DEV_APP_ID) {
    throw new Error(`Mobile staging must use ${DEV_APP_ID}`);
  }

  const supabaseUrl = parseHttpsUrl(
    required(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    'NEXT_PUBLIC_SUPABASE_URL'
  );
  const expectedProjectRef = required(
    env,
    'MOBILE_EXPECTED_SUPABASE_PROJECT_REF'
  ).toLowerCase();
  const blockedProjectRefs = csv(
    required(env, 'MOBILE_BLOCKED_SUPABASE_PROJECT_REFS')
  );
  if (blockedProjectRefs.size === 0) {
    throw new Error('At least one production Supabase project ref must be blocked');
  }

  const expectedSupabaseHost = `${expectedProjectRef}.supabase.co`;
  if (supabaseUrl.hostname.toLowerCase() !== expectedSupabaseHost) {
    throw new Error(
      `Supabase host must match the approved staging project ${expectedProjectRef}`
    );
  }
  if (blockedProjectRefs.has(expectedProjectRef)) {
    throw new Error('The approved staging Supabase project is marked as production');
  }

  const appUrl = parseHttpsUrl(
    required(env, 'NEXT_PUBLIC_APP_URL'),
    'NEXT_PUBLIC_APP_URL'
  );
  const expectedAppHost = required(env, 'MOBILE_EXPECTED_APP_HOST').toLowerCase();
  const blockedAppHosts = csv(required(env, 'MOBILE_BLOCKED_APP_HOSTS'));
  if (blockedAppHosts.size === 0) {
    throw new Error('At least one production application host must be blocked');
  }
  if (appUrl.hostname.toLowerCase() !== expectedAppHost) {
    throw new Error(`Application host must match approved staging host ${expectedAppHost}`);
  }
  if (blockedAppHosts.has(expectedAppHost)) {
    throw new Error('The approved staging application host is marked as production');
  }

  return {
    profile,
    appId,
    supabaseProjectRef: expectedProjectRef,
    appHost: expectedAppHost,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const result = validateMobileEnvironment(process.env);
    console.log(
      `Mobile environment safe: ${result.profile}, ${result.appId}, ` +
        `${result.supabaseProjectRef}, ${result.appHost}`
    );
  } catch (error) {
    console.error(`Mobile environment rejected: ${error.message}`);
    process.exitCode = 1;
  }
}
