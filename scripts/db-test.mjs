// Chay test pgTAP trong supabase/tests tren database (moi file chay trong transaction va rollback).
//   node scripts/db-test.mjs
// Can .env.local: SUPABASE_DB_URL (chuoi ket noi Postgres, Session pooler).

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local', quiet: true });

const dir = path.join('supabase', 'tests');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.sql')).sort();

function expandIncludes(sql) {
  return sql.replace(/^-- @include (.+)$/gm, (_, f) => fs.readFileSync(path.join('supabase', 'tests', 'include', f.trim()), 'utf8'));
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Thiếu SUPABASE_DB_URL');
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let failed = 0;
  try {
    for (const f of files) {
      const sql = expandIncludes(fs.readFileSync(path.join(dir, f), 'utf8'));
      console.log(`# ${f}`);
      const results = await client.query(sql);
      const lines = (Array.isArray(results) ? results : [results])
        .flatMap((r) => r.rows ?? [])
        .flatMap((row) => Object.values(row))
        .filter((v) => typeof v === 'string' && /^(ok|not ok|1\.\.|#)/.test(v));
      for (const l of lines) {
        console.log(l);
        if (l.startsWith('not ok') || /Looks like you failed/.test(l)) failed++;
      }
    }
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
  if (failed) {
    console.error(`THAT BAI: ${failed}`);
    process.exit(1);
  }
  console.log('TAT CA TEST DAT');
}

main().catch((e) => {
  console.error('LOI:', e.message || e);
  process.exit(1);
});
