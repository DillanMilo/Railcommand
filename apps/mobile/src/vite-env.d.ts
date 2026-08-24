/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_PRODUCTION_BUILD?: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_NUMBER: string;
  readonly VITE_BUILD_PROFILE: string;
  readonly VITE_EXPECTED_API_HOST?: string;
  readonly VITE_EXPECTED_SUPABASE_PROJECT_REF?: string;
  readonly VITE_MOBILE_APP_ID: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
