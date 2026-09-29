// Deliberately small SQL convention check, backed by PostgreSQL integration tests.
// Use schema-qualified, literal CREATE/GRANT/REVOKE statements in migrations.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hide comments, string literals and function bodies so examples cannot satisfy
// the gate. Preserve quoted identifiers and statement boundaries.
export function sqlCode(sql) {
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|(\$[a-z_0-9]*\$)[\s\S]*?\1/gi, ' ')
    .replace(/"([a-z_][a-z_0-9]*)"/gi, '$1').toLowerCase();
}

export function checkSql(sql) {
  const code = sqlCode(sql);
  const statements = code.split(';').map(s => s.trim());
  const errors = [];
  const tables = [...code.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(public\s*\.\s*)?([a-z_][a-z_0-9]*)\s*(?:\(|as\b)/g)];
  for (const [, schema, table] of tables) {
    if (!schema) errors.push(`${table}: qualify CREATE TABLE with public (or a private schema)`);
    const target = `public\\s*\\.\\s*${table}\\b`;
    const rls = new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?${target}\\s+enable\\s+row\\s+level\\s+security\\b`);
    if (!rls.test(code)) errors.push(`${table}: enable RLS in the table-creation file`);
    const grant = new RegExp(`^grant\\s+[\\s\\S]+?\\s+on\\s+(?:table\\s+)?${target}\\s+to\\s+[\\s\\S]*\\b(?:authenticated|service_role|anon)\\b`);
    const privateRevoke = new RegExp(`^revoke\\s+all(?:\\s+privileges)?\\s+on\\s+(?:table\\s+)?${target}\\s+from\\s+([\\s\\S]+)$`);
    const explicitPrivate = statements.some(s => {
      const roles = s.match(privateRevoke)?.[1].split(',').map(r => r.trim());
      return roles && ['public', 'anon', 'authenticated', 'service_role'].every(r => roles.includes(r));
    });
    if (!statements.some(s => grant.test(s)) && !explicitPrivate) {
      errors.push(`${table}: add role-specific GRANTs (or explicitly revoke all API roles for a private table) in this file`);
    }
  }
  for (const s of statements) {
    if (/^alter\s+default\s+privileges\b/.test(s) && /\bgrant\b[\s\S]*\bon\s+(?:tables|sequences)\s+to\b[\s\S]*\b(?:anon|authenticated|service_role|public)\b/.test(s)) {
      errors.push('Do not restore automatic table/sequence grants to API roles');
    }
  }
  return { tables: tables.map(m => m[2]), errors };
}

export function checkRepository(root) {
  const files = ['supabase/migrations', 'docs/migrations'].flatMap(dir =>
    readdirSync(resolve(root, dir)).filter(f => f.endsWith('.sql')).sort().map(f => `${dir}/${f}`));
  files.push('supabase/schema_snapshot.sql');
  let count = 0;
  const errors = [];
  for (const file of files) {
    const result = checkSql(readFileSync(resolve(root, file), 'utf8'));
    count += result.tables.length;
    errors.push(...result.errors.map(e => `${file}: ${e}`));
  }
  return { files: files.length, tables: count, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)));
  const result = checkRepository(root);
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`Database grant gate passed: ${result.tables} table definitions in ${result.files} SQL files (${relative(process.cwd(), root) || '.'}).`);
}
