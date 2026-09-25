// Khoi tao lan dau: tao cua hang dau tien va tai khoan sadmin.
//
//   node scripts/bootstrap.mjs --store-code SU --store-name "Siêu Thị Úc" --username <ten> --full-name "<Ho ten>"
//
// Can .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Mat khau sinh ngau nhien, in ra 1 lan duy nhat (hoac dat san bang bien BOOTSTRAP_PASSWORD).

import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const storeCode = arg('store-code');
const storeName = arg('store-name');
const username = arg('username')?.trim().toLowerCase();
const fullName = arg('full-name');

async function main() {
  if (!storeCode || !storeName || !username || !fullName) {
    throw new Error('Thiếu tham số. Xem hướng dẫn ở đầu file.');
  }
  if (!/^[A-Z0-9]{2,10}$/.test(storeCode)) throw new Error('Mã cửa hàng: 2-10 ký tự IN HOA hoặc số');
  if (!/^[a-z0-9._]{3,32}$/.test(username)) throw new Error('Username: 3-32 ký tự a-z, 0-9, dấu chấm, gạch dưới');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Cua hang
  let { data: store } = await admin.from('stores').select('id, code').eq('code', storeCode).maybeSingle();
  if (!store) {
    const res = await admin.from('stores').insert({ code: storeCode, name: storeName }).select('id, code').single();
    if (res.error) throw res.error;
    store = res.data;
    console.log(`Da tao cua hang ${storeCode}`);
  } else {
    console.log(`Cua hang ${storeCode} da co, bo qua`);
  }

  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) throw new Error(`Username ${username} đã tồn tại`);

  const password = process.env.BOOTSTRAP_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: `${username}@sieuthiuc.local`,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (authErr) throw authErr;

  const uid = created.user.id;
  const p = await admin.from('profiles').insert({
    id: uid, username, full_name: fullName, role: 'sadmin', default_store_id: store.id,
  });
  if (p.error) {
    await admin.auth.admin.deleteUser(uid);
    throw p.error;
  }
  const us = await admin.from('user_stores').insert({ user_id: uid, store_id: store.id });
  if (us.error) throw us.error;

  console.log('Da tao tai khoan sadmin:');
  console.log(`  Ten dang nhap: ${username}`);
  if (!process.env.BOOTSTRAP_PASSWORD) console.log(`  Mat khau:      ${password}   (doi sau khi dang nhap)`);
}

main().catch((e) => {
  console.error('LOI:', e.message || e);
  process.exit(1);
});
