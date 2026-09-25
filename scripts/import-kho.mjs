// Import ton dau ky tu file "kho hang.xlsx" (sheet AIR va CONT).
//
// Cach dung:
//   node scripts/import-kho.mjs --dry-run            -> chi doc file, in tong hop, ghi data/import-preview.json
//   node scripts/import-kho.mjs --store SU           -> goi RPC import_opening_stock (dang nhap bang sadmin)
//
// Bien moi truong (.env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//   IMPORT_USERNAME, IMPORT_PASSWORD (tai khoan sadmin).
//
// Quy tac doc file (theo cau truc file ngay 25/09/2026):
//   * Sheet AIR -> goods_type 'air'; sheet CONT -> 'cont'. Sheet TONG khong dung (khong khop tong AIR + CONT).
//   * O gop doc (merged theo cot) duoc dien lai gia tri o dau vung gop, dung nhu khi nhin tren Excel.
//   * Dong nhom (co ten, khong co so luong) khong phai san pham; ten dong con = "<ten nhom> - <ten con>".
//   * So luong ton = cot "CON LAI". Ton am -> 0 va ghi chu.
//   * Gia von dang chu ("Tang", "Mua tai ...") -> 0, giu nguyen chu trong ghi chu.
//   * Thieu DVT -> "Chưa rõ"; thieu gia -> 0; deu ghi chu de bo sung sau.
//   * Trung ten trong cung loai hang -> them " - <DVT>" vao ten.

import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
XLSX.set_fs(fs);

const FILE = 'kho hang.xlsx';
const SHEETS = [
  { name: 'AIR', goods_type: 'air' },
  { name: 'CONT', goods_type: 'cont' },
];
const COL = { no: 0, name: 1, unit: 2, qty: 3, cost: 4, price: 5, sold: 6, remain: 7 };

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const storeCode = args.includes('--store') ? args[args.indexOf('--store') + 1] : null;

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function clean(v) {
  return typeof v === 'string' ? v.trim() : v;
}

function readSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Không thấy sheet ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const merges = ws['!merges'] || [];
  // group info: cot A gop doc => nhom
  const groupOf = new Map();
  for (const m of merges) {
    if (m.s.c !== m.e.c || m.s.r === m.e.r) continue; // chi xu ly gop doc
    for (let r = m.s.r + 1; r <= m.e.r; r++) {
      rows[r] = rows[r] || [];
      rows[r][m.s.c] = rows[m.s.r][m.s.c];
      if (m.s.c === COL.no) groupOf.set(r, m.s.r);
    }
    if (m.s.c === COL.no) groupOf.set(m.s.r, m.s.r);
  }
  return { rows, groupOf };
}

function parse() {
  const wb = XLSX.readFile(FILE);
  const items = [];
  const warnings = [];

  for (const sh of SHEETS) {
    const { rows, groupOf } = readSheet(wb, sh.name);
    const parentName = new Map(); // row index cua dong nhom -> ten nhom
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = clean(row[COL.name]);
      if (!name) continue;
      const rowNo = r + 1;

      // dong nhom: khong co so luong nhap va khong co ton
      if (row[COL.qty] == null && row[COL.remain] == null) {
        parentName.set(r, name);
        continue;
      }

      const g = groupOf.get(r);
      const fullName = g != null && g !== r && parentName.has(g) ? `${parentName.get(g)} - ${name}` : name;

      const notes = [];
      let unit = clean(row[COL.unit]);
      if (!unit) {
        unit = 'Chưa rõ';
        notes.push('Thiếu ĐVT trong file');
      }

      let cost = 0;
      if (isNum(row[COL.cost])) cost = Math.round(row[COL.cost]);
      else if (row[COL.cost] != null) notes.push(`Giá vốn trong file: ${clean(row[COL.cost])}`);
      else notes.push('Thiếu giá vốn trong file');

      let price = 0;
      if (isNum(row[COL.price])) price = Math.round(row[COL.price]);
      else notes.push('Thiếu giá bán trong file');

      let qty = isNum(row[COL.remain]) ? row[COL.remain] : 0;
      if (!isNum(row[COL.remain])) notes.push('Thiếu số lượng còn lại trong file');
      if (qty < 0) {
        notes.push(`Tồn âm trong file: ${qty}`);
        warnings.push(`${sh.name} dòng ${rowNo}: tồn âm ${qty} -> 0 (${fullName})`);
        qty = 0;
      }

      items.push({
        sheet: sh.name,
        row: rowNo,
        name: fullName,
        unit,
        goods_type: sh.goods_type,
        sell_price: price,
        cost,
        qty,
        note: notes.join('; '),
      });
    }
  }

  // trung ten trong cung loai hang -> them DVT
  const key = (it) => `${it.goods_type}|${it.name.toLowerCase()}`;
  const count = new Map();
  for (const it of items) count.set(key(it), (count.get(key(it)) || 0) + 1);
  for (const it of items) {
    if (count.get(key(it)) > 1) {
      warnings.push(`${it.sheet} dòng ${it.row}: trùng tên, đổi thành "${it.name} - ${it.unit}"`);
      it.name = `${it.name} - ${it.unit}`;
    }
  }
  const after = new Map();
  for (const it of items) after.set(key(it), (after.get(key(it)) || 0) + 1);
  const stillDup = [...after.entries()].filter(([, c]) => c > 1);
  if (stillDup.length) throw new Error(`Vẫn còn tên trùng: ${stillDup.map(([k]) => k).join(', ')}`);

  return { items, warnings };
}

function summarize(items) {
  const by = {};
  for (const it of items) {
    const s = (by[it.goods_type] ||= { products: 0, qty: 0, stock_value: 0, missing_unit: 0, missing_cost: 0, missing_price: 0 });
    s.products++;
    s.qty += it.qty;
    s.stock_value += it.qty * it.cost;
    if (it.unit === 'Chưa rõ') s.missing_unit++;
    if (it.cost === 0) s.missing_cost++;
    if (it.sell_price === 0) s.missing_price++;
  }
  return by;
}

async function main() {
  const { items, warnings } = parse();
  const summary = summarize(items);

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(path.join('data', 'import-preview.json'), JSON.stringify({ summary, warnings, items }, null, 2));

  console.log('Tong hop theo loai hang:');
  console.table(summary);
  console.log(`Canh bao (${warnings.length}):`);
  for (const w of warnings) console.log('  - ' + w);
  console.log('Chi tiet: data/import-preview.json');

  if (dryRun) return;
  if (!storeCode) throw new Error('Thiếu --store <MÃ CỬA HÀNG>');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const username = process.env.IMPORT_USERNAME;
  const password = process.env.IMPORT_PASSWORD;
  if (!url || !anon || !username || !password) throw new Error('Thiếu biến môi trường (xem đầu file)');

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: `${username.toLowerCase()}@sieuthiuc.local`,
    password,
  });
  if (loginErr) throw loginErr;

  const { data: store, error: storeErr } = await supabase.from('stores').select('id, code, name').eq('code', storeCode).single();
  if (storeErr) throw storeErr;

  const payload = items.map(({ name, unit, goods_type, sell_price, cost, qty, note }) => ({
    name, unit, goods_type, sell_price, cost, qty, note,
  }));
  const { data, error } = await supabase.rpc('import_opening_stock', { p_store_id: store.id, p_items: payload });
  if (error) throw error;
  console.log(`Da import vao ${store.code} - ${store.name}:`, data);
}

main().catch((e) => {
  console.error('LOI:', e.message || e);
  process.exit(1);
});
