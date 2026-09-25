# Hệ thống quản lý cửa hàng Siêu Thị Úc

Tài liệu kỹ thuật sống của dự án. Đọc trước khi sửa code. Nguồn nghiệp vụ gốc: `SPEC_He_Thong_Quan_Ly_Cua_Hang.md` và `Feature_List_Cai_Tien.xlsx` ở thư mục gốc trên máy phát triển (không đưa lên repo public). Khi tài liệu này khác SPEC, tài liệu này thể hiện quyết định đã chốt với khách.

## Table of Contents

- [1. Tổng quan](#1-tổng-quan)
- [2. Công nghệ và kiến trúc](#2-công-nghệ-và-kiến-trúc)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
- [4. Vai trò và phân quyền](#4-vai-trò-và-phân-quyền)
- [5. Mô hình dữ liệu đã triển khai](#5-mô-hình-dữ-liệu-đã-triển-khai)
- [6. Quy ước](#6-quy-ước)
- [7. Quyết định đã chốt và khác biệt so với SPEC](#7-quyết-định-đã-chốt-và-khác-biệt-so-với-spec)
- [8. Dữ liệu tồn đầu kỳ](#8-dữ-liệu-tồn-đầu-kỳ)
- [9. Chạy trên máy](#9-chạy-trên-máy)
- [10. Triển khai production](#10-triển-khai-production)
- [11. Tiến độ](#11-tiến-độ)

## 1. Tổng quan

Web app (PWA) quản lý bán hàng, kho, công nợ nhà cung cấp, thu chi và lãi lỗ cho cửa hàng bán lẻ hàng nhập khẩu. Chạy trên Chrome máy tính tại quầy và cài được lên điện thoại như ứng dụng (PWA).

| Hạng mục | Giá trị |
|---|---|
| Production | https://sieuthiuc.vercel.app |
| Mã nguồn | https://github.com/beyeu2601/sieuthiuc (public, không chứa dữ liệu kinh doanh) |
| Database | Supabase project `mmnfhppaupmvkdggekbz` (một môi trường duy nhất: production) |
| Phạm vi hiện tại | Toàn bộ P0, một cửa hàng, schema sẵn sàng cho nhiều cửa hàng |

## 2. Công nghệ và kiến trúc

- Next.js 15 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui (bản Base UI).
- Supabase: PostgreSQL 17, Auth, RLS. Chưa dùng Storage, Realtime, Edge Functions ở Sprint 0.
- `@supabase/ssr` cho session qua cookie; `src/middleware.ts` làm mới session và chuyển về `/login` khi chưa đăng nhập.
- Nguyên tắc từ SPEC mục 0.1 giữ nguyên: mọi logic làm thay đổi số liệu nghiệp vụ nằm trong PostgreSQL (RPC), client chỉ gọi RPC và hiển thị; không xóa cứng dữ liệu nghiệp vụ; tiền là `bigint` VND, số lượng là `numeric(12,3)`.
- Máy quét mã vạch USB (Kiosk Việt) hoạt động như bàn phím, không cần driver. In hóa đơn dùng trang in của trình duyệt; chưa làm máy in nhiệt ESC/POS và ngăn kéo tiền.

## 3. Cấu trúc thư mục

```
src/app/login            Đăng nhập bằng username
src/app/(app)/[store]    Màn hình nghiệp vụ theo cửa hàng (route theo mã cửa hàng)
src/app/(app)/settings   Cài đặt (sadmin, admin)
src/components/ui        shadcn/ui
src/lib/auth.ts          Đọc session, hồ sơ, cửa hàng; requireSession, requireRole (chỉ server)
src/lib/roles.ts         Vai trò, nhãn, quy tắc username (dùng được ở client)
src/lib/nav.ts           Menu theo vai trò
src/lib/supabase         Client trình duyệt, server, middleware
supabase/migrations      SQL theo thứ tự thời gian
supabase/tests           Test pgTAP, chạy bằng npm run db:test
scripts                  bootstrap (tạo cửa hàng + sadmin), import-kho (tồn đầu kỳ), db-test
docs                     Tài liệu này
```

## 4. Vai trò và phân quyền

| Vai trò (`app_role`) | Nhãn | Phạm vi |
|---|---|---|
| `sadmin` | Quản trị hệ thống | Mọi cửa hàng, người dùng, cấu hình chung |
| `admin` | Quản lý cửa hàng | Toàn quyền trong cửa hàng được gán (tương ứng "Chủ tiệm" của SPEC trong phạm vi cửa hàng) |
| `accountant` | Kế toán | Cửa hàng được gán, quyền theo ma trận SPEC mục 4.2 |
| `staff` | Nhân viên | Cửa hàng được gán, quyền theo ma trận SPEC mục 4.2 |

Cơ chế:

- Quyền đọc từ bảng `profiles` và `user_stores` qua các hàm `SECURITY DEFINER`: `auth_role()`, `auth_store_ids()`, `can_access_store(store_id)`, `is_store_manager(store_id)`, `auth_has_perm(key)`, `assert_role(...)`. Đổi quyền có hiệu lực ngay ở request kế tiếp.
- RLS bật trên mọi bảng. SELECT đi qua RLS; ghi dữ liệu nghiệp vụ chỉ qua RPC. Bảng danh mục (sản phẩm, barcode, nhóm hàng, thương hiệu) cho `sadmin` và `admin` ghi trực tiếp.
- Tài khoản không có hồ sơ hoặc bị khóa (`is_active = false`) không đọc được dữ liệu nào.
- Trigger `protect_last_sadmin` chặn hạ quyền hoặc khóa sadmin cuối cùng.
- Quyền mở rộng cá nhân lưu ở `profiles.extra_permissions` (ví dụ `{"confirm_receipt": true}`).

## 5. Mô hình dữ liệu đã triển khai

| Migration | Nội dung |
|---|---|
| `20260925000001_extensions_enums` | `pg_trgm`, toàn bộ enum SPEC 6.1, trigger `set_updated_at` |
| `20260925000002_org_auth_settings_audit` | `stores`, `profiles`, `user_stores`, `settings`, `document_sequences`, `audit_logs`; hàm phân quyền; `get_setting`, `set_setting`, `next_doc_code`; trigger audit |
| `20260925000003_products` | `categories`, `brands`, `products`, `product_barcodes`, `price_history`; trigger ghi lịch sử giá |
| `20260925000004_inventory` | `inventory`, `stock_lots`, `stock_movements`; RPC `import_opening_stock`, `store_overview` |
| `20260925000005_seed_settings` | Cấu hình mặc định theo SPEC Phụ lục A |

Các bảng còn lại của SPEC mục 6 được thêm theo từng sprint ở mục 11.

## 6. Quy ước

- Tên bảng, cột: `snake_case` tiếng Anh. Nhãn giao diện: tiếng Việt.
- Tiền hiển thị `1.234.567 ₫`, ngày `dd/MM/yyyy`, giờ 24h, múi giờ `Asia/Ho_Chi_Minh` (`src/lib/format`).
- Mã chứng từ sinh trong DB: `{PREFIX}-{MÃ CỬA HÀNG}-{YYMMDD}-{số thứ tự 4 chữ số}`. SKU sản phẩm: `SP-000001`.
- RPC báo lỗi bằng `RAISE EXCEPTION`; thông điệp tiếng Việt ở `message`, mã lỗi (`FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `INVALID_STATE`, `ALREADY_CONFIRMED`...) ở `hint`. Supabase JS trả về trong `error.message` và `error.hint`.
- Hàm mới: `SECURITY DEFINER` khi cần vượt RLS, luôn `set search_path = ''`, kiểm tra quyền ở đầu hàm, `revoke execute ... from public, anon`.
- Mỗi migration mới đi kèm test pgTAP trong `supabase/tests`.

## 7. Quyết định đã chốt và khác biệt so với SPEC

Quyết định của khách ngày 25/09/2026:

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Mobile | PWA, không đăng App Store / Play Store |
| 2 | Môi trường | Một Supabase project production duy nhất |
| 3 | Số cửa hàng | Một cửa hàng; schema giữ `store_id` |
| 4 | Vai trò | Bốn vai trò: sadmin, admin, accountant, staff |
| 5 | Hạng thành viên | Dùng mặc định SPEC, admin chỉnh được |
| 6 | Hóa đơn điện tử | Có nghĩa vụ nhưng chưa làm ở giai đoạn này |
| 7 | Phạm vi | Làm hết P0 trước |
| 8 | Đăng nhập | Username, không dùng email |
| 9 | Thiết bị | Chrome; máy quét USB Kiosk Việt; chưa làm máy in nhiệt, ngăn kéo tiền |
| 10 | Mạng | Ổn định; offline POS giữ ở P2 |
| 11 | Shopee | Quản lý đơn thủ công, chưa tích hợp API |
| 12 | Loại hàng | Mặt hàng nhập theo cả hai kênh Cont và Air được tạo thành hai mã sản phẩm riêng |

Khác biệt kỹ thuật so với SPEC:

- Không dùng custom JWT claims và Auth Hook; quyền đọc trực tiếp từ bảng (mục 4).
- Tạo người dùng sẽ làm bằng route server của Next.js dùng service role, thay cho Edge Function `admin-create-user`.
- `settings` dùng `id` làm khóa chính và ràng buộc `unique nulls not distinct (key, store_id)` thay cho khóa chính có `coalesce` (cú pháp SPEC không hợp lệ).
- `movement_type` thêm giá trị `opening` cho tồn đầu kỳ.
- `products.goods_type` bắt buộc.
- RPC trả lỗi bằng exception thay cho JSON `{ok, data, error}` để giao dịch luôn rollback trọn vẹn.

Việc còn mở cần làm ở sprint sau:

- Ẩn giá vốn và giá trị tồn với nhân viên ở tầng dữ liệu (hiện RLS cho mọi người dùng đăng nhập đọc bảng `products`). Làm ở Sprint 1 khi có màn hình sản phẩm.
- Khóa đăng nhập sau 5 lần sai (SPEC mục 17). Hiện dựa vào giới hạn tần suất của Supabase Auth.

## 8. Dữ liệu tồn đầu kỳ

Nguồn: `kho hang.xlsx` (không đưa lên GitHub). Script: `scripts/import-kho.mjs`.

- Đọc hai sheet `AIR` và `CONT`. Không dùng sheet `TỔNG` vì tổng tồn không khớp hai sheet kia.
- Ô gộp theo cột được đọc lại đúng giá trị ô đầu vùng gộp.
- Dòng nhóm (có tên, không có số lượng) không phải sản phẩm; dòng con được đặt tên `<tên nhóm> - <tên con>`.
- Tồn = cột "CÒN LẠI". Tồn âm đưa về 0 và ghi chú. Giá vốn dạng chữ đưa về 0, giữ chữ trong ghi chú.
- Tên trùng trong cùng loại hàng được thêm `- <ĐVT>`.
- Mỗi sản phẩm có tồn tạo một lô `TONDAU` không hạn dùng và một biến động `opening`. Hàm `import_opening_stock` chỉ chạy được một lần cho mỗi cửa hàng.

Chạy thử không ghi DB: `npm run import:kho -- --dry-run`, kết quả ở `data/import-preview.json`.

## 9. Chạy trên máy

```
npm install
cp .env.example .env.local      # điền giá trị
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint
npm run db:test                 # test pgTAP trên database
```

## 10. Triển khai production

Thứ tự khi có migration mới:

```
supabase link --project-ref mmnfhppaupmvkdggekbz
supabase db push                # áp dụng migration mới
supabase config push            # đồng bộ cấu hình Auth (tắt đăng ký công khai, mật khẩu tối thiểu 8)
npm run db:test                 # phải đạt trước khi deploy app
git push origin main            # Vercel tự build và deploy
```

Khởi tạo lần đầu (đã chạy một lần, không chạy lại):

```
npm run bootstrap -- --store-code SU --store-name "Siêu Thị Úc" --username <ten> --full-name "<Họ tên>"
npm run import:kho -- --store SU
```

Biến môi trường trên Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role key không đặt trên Vercel cho tới khi có màn hình quản lý người dùng.

## 11. Tiến độ

| Sprint | Phạm vi | Trạng thái |
|---|---|---|
| 0 | Khung app, đăng nhập username, phân quyền 4 vai trò, RLS, cấu hình, audit, sản phẩm và kho lõi, import tồn đầu kỳ | Code xong, chờ quyền truy cập Supabase để áp dụng migration |
| 1 | Sản phẩm, barcode, giá, % Benefit, nhà cung cấp, quản lý người dùng, cài đặt | Chưa bắt đầu |
| 2 | Phiếu nhập, lô, giá vốn bình quân, tồn kho, biến động, cảnh báo tồn thấp | Chưa bắt đầu |
| 3 | Ca làm việc, POS, thanh toán, in hóa đơn, hủy giao dịch | Chưa bắt đầu |
| 4 | Đơn hàng online, công nợ, thu chi, đối soát, PnL, doanh thu, COGS, chi phí | Chưa bắt đầu |
