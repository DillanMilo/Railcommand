import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublicEnv: PublicEnv | null = null;

function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return cachedPublicEnv;
}

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return getPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
  get NEXT_PUBLIC_APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL;
  },
  get NEXT_PUBLIC_SITE_URL() {
    return process.env.NEXT_PUBLIC_SITE_URL;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
  get OPENAI_API_KEY() {
    return process.env.OPENAI_API_KEY;
  },
  get RESEND_API_KEY() {
    return process.env.RESEND_API_KEY;
  },
  get RESEND_FROM_EMAIL() {
    return process.env.RESEND_FROM_EMAIL;
  },
  get EMAIL_API_KEY() {
    return process.env.EMAIL_API_KEY;
  },
  get NOTIFICATIONS_API_KEY() {
    return process.env.NOTIFICATIONS_API_KEY;
  },
  get CRON_SECRET() {
    return process.env.CRON_SECRET;
  },
} as const;
