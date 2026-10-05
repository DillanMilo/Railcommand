import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const matrix = JSON.parse(readFileSync(resolve(root, 'docs/mobile/WEB_MOBILE_PARITY.json'), 'utf8'));
const known = new Map(matrix.areas.map(area => [area.webSource, new Set(area.actions.map(action => action.name))]));
const errors = [];
for (const file of readdirSync(resolve(root, 'src/lib/actions')).filter(file => file.endsWith('.ts') && !file.includes(' 2.') && file !== 'permissions-helper.ts')) {
  const path = `src/lib/actions/${file}`;
  const source = readFileSync(resolve(root, path), 'utf8');
  for (const [, name] of source.matchAll(/export async function (\w+)\(/g)) {
    if (!known.get(path)?.has(name)) errors.push(`Missing web/mobile assessment: ${path}:${name}`);
  }
}
const actions = matrix.areas.flatMap(area => area.actions);
const incomplete = actions.filter(action => action.mobile !== 'verified' || !action.deviceVerified);
if (process.argv.includes('--require-complete') && (incomplete.length || matrix.additionalGates.length)) {
  errors.push(`Full parity blocked: ${incomplete.length} actions and ${matrix.additionalGates.length} release gates remain unverified.`);
}
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
else console.log(`Inventory covered: ${actions.length} web actions. ${incomplete.length} still require parity acceptance. This is not a release approval.`);
