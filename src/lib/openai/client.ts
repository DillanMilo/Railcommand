import OpenAI from 'openai';

import { env } from '@/lib/env';

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to use OpenAI API routes.');
  }

  client ??= new OpenAI({ apiKey });
  return client;
}
