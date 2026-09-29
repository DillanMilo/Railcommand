import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkSql, checkRepository } from './check-database-grants.mjs';
const table = 'create table public.example(id uuid); alter table public.example enable row level security;';
const grant = 'grant select on table public.example to authenticated;';
test('repository table creation has explicit grants and RLS', () => {
  assert.deepEqual(checkRepository(new URL('..', import.meta.url).pathname).errors, []);
});
test('missing grants fail even when RLS and policies exist', () => {
  assert.match(checkSql(table).errors.join('\n'), /GRANTs/);
});
test('comments, strings, function bodies and another table cannot supply grants', () => {
  for (const fake of [`-- ${grant}`, `/* ${grant} */`, `select '${grant}';`, `do $$ begin ${grant} end $$;`, grant.replace('example', 'unrelated')]) {
    assert.match(checkSql(table + fake).errors.join('\n'), /GRANTs/);
  }
});
test('quoted names, column grants and multiple API roles are supported', () => {
  assert.deepEqual(checkSql('CREATE TABLE "public"."example"(id uuid); ALTER TABLE "public"."example" ENABLE ROW LEVEL SECURITY; GRANT UPDATE (id) ON "public"."example" TO authenticated, service_role;').errors, []);
});
test('RLS must accompany explicit grants', () => {
  assert.match(checkSql('create table public.example(id uuid);' + grant).errors.join('\n'), /RLS/);
});
test('table-wide default grants cannot substitute for explicit table grants', () => {
  assert.equal(checkSql(table + 'alter default privileges in schema public grant all on tables to authenticated;').errors.length, 2);
});
test('default sequence grants to API roles are rejected', () => {
  assert.match(checkSql('alter default privileges in schema public grant usage on sequences to anon;').errors.join('\n'), /automatic/);
});
test('private tables require deliberate denial to all API roles', () => {
  assert.deepEqual(checkSql(table + 'revoke all on public.example from public, anon, authenticated, service_role;').errors, []);
});
test('unqualified table creation fails closed; explicit private schemas are outside the gate', () => {
  assert.match(checkSql('create table example(id uuid);').errors.join('\n'), /qualify/);
  assert.deepEqual(checkSql('create table private.example(id uuid);').errors, []);
});
