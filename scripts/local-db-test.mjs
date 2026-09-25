// Chay toan bo migration + test pgTAP tren Postgres nhung trong Node (PGlite), khong can Docker/Supabase.
//   npm run db:test:local
// Gia lap phan rieng cua Supabase: schema auth, auth.uid()/auth.jwt(), vai tro anon/authenticated/service_role,
// quyen mac dinh tren schema public. Khong thay the test tren database that (npm run db:test).

import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pgtap } from '@electric-sql/pglite-pgtap';

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

function list(dir, suffix) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(suffix)).sort().map((f) => path.join(dir, f));
}

function expandIncludes(sql) {
  return sql.replace(/^-- @include (.+)$/gm, (_, f) => fs.readFileSync(path.join('supabase', 'tests', 'include', f.trim()), 'utf8'));
}

async function main() {
  const only = process.argv[2];
  const db = await PGlite.create({ extensions: { pg_trgm, unaccent, pgcrypto, pgtap } });
  await db.exec(SHIM);

  for (const f of list('supabase/migrations', '.sql')) {
    try {
      await db.exec(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      console.error(`MIGRATION LOI: ${f}\n  ${e.message}${e.hint ? `\n  hint: ${e.hint}` : ''}${e.where ? `\n  ${e.where}` : ''}`);
      process.exit(1);
    }
  }
  console.log('Migrations: OK');

  let failed = 0;
  let total = 0;
  for (const f of list('supabase/tests', '.test.sql')) {
    if (only && !f.includes(only)) continue;
    console.log(`# ${path.basename(f)}`);
    try {
      const results = await db.exec(expandIncludes(fs.readFileSync(f, 'utf8')));
      const lines = results
        .flatMap((r) => r.rows ?? [])
        .flatMap((row) => Object.values(row))
        .filter((v) => typeof v === 'string' && /^(ok|not ok|1\.\.|#)/.test(v));
      for (const l of lines) {
        if (l.startsWith('not ok') || l.startsWith('#')) console.log('  ' + l);
        if (l.startsWith('ok') || l.startsWith('not ok')) total++;
        if (l.startsWith('not ok') || /Looks like you (failed|planned)/.test(l)) failed++;
      }
    } catch (e) {
      failed++;
      console.error(`  LOI: ${e.message}${e.hint ? ` (hint: ${e.hint})` : ''}${e.where ? `\n  ${e.where}` : ''}`);
      await db.exec('rollback').catch(() => {});
    }
  }
  console.log(`Tests: ${total - failed}/${total} dat${failed ? `, ${failed} loi` : ''}`);

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
