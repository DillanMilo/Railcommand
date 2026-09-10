// Emits SQL only. Never connects to a database or loads application credentials.
import { readFileSync } from 'node:fs';
const base = new URL('../supabase/recovery/', import.meta.url);
const reference = JSON.parse(readFileSync(new URL('staging-guard-reference-20260909.json', base), 'utf8'));
const entry = reference.definitions.find(item => item.name === 'assert_stored_object');
if (!entry || entry.security_definer !== false) throw new Error('Expected invoker reference missing');
const fixture = readFileSync(new URL('local-storage-metadata-smoke.sql', base), 'utf8');
process.stdout.write(fixture.replace('-- REFERENCE_FUNCTIONS', () => `${entry.definition.trim()};`));
