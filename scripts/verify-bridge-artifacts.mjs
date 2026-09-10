import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exact inputs recorded by the September 5 hosted staging rehearsal.
export const expectedArtifacts = [
  ['supabase/staging/production_bridge_preflight.sql', '3979a1c7e477a69060555f411fdb89279b32362c0acd7d5aef1255ad404a9143'],
  ['supabase/migrations/20260903221812_production_mobile_bridge_foundation.sql', '0918fb818daac834fb67c5e0ab256d5bfa82b4b0d12ecf4bb3a137cad3bdbcd9'],
  ['supabase/staging/production_bridge_assign_number_baseline.sql', '320857c0dc9df221dbe4827ad475293fc10b55f24e497f4d33e06b38aac952c1'],
  ['supabase/migrations/20260903222219_production_mobile_write_hardening.sql', 'b51efdc98cd65fe11a0fbf4d89cb6bb5957da473500821718999bb1dd221c34d'],
  ['supabase/staging/production_bridge_acceptance.sql', '1d6a0fbe0e76c11ffbe4942c802e65a10ef600d36a3f75a3b30ee87eac754af2'],
  ['supabase/staging/production_bridge_postflight.sql', '8961ec12f54f8c7f70c3d62cb2564ece264396cb4f7574e8164b2d79d0d2f3e9'],
];

export function verifyArtifacts(root, read = readFileSync, expected = expectedArtifacts) {
  return expected.map(([file, hash]) => {
    try {
      const actual = createHash('sha256').update(read(resolve(root, file))).digest('hex');
      return { file, status: actual === hash ? 'verified' : 'mismatch' };
    } catch (error) {
      return { file, status: error.code === 'ENOENT' ? 'missing' : 'unreadable' };
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = verifyArtifacts(resolve(process.argv[2] ?? '.'));
  console.log(JSON.stringify({ ready: results.every(x => x.status === 'verified'), results }, null, 2));
  process.exitCode = results.every(x => x.status === 'verified') ? 0 : 1;
}
