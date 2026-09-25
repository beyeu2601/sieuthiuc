# Hệ thống quản lý cửa hàng Siêu Thị Úc

Tài liệu kỹ thuật sống của dự án. Đọc trước khi sửa code. Nguồn nghiệp vụ gốc: `SPEC_He_Thong_Quan_Ly_Cua_Hang.md` và `Feature_List_Cai_Tien.xlsx` ở thư mục gốc trên máy phát triển (không đưa lên repo public). Khi tài liệu này khác SPEC, tài liệu này thể hiện quyết định đã chốt với khách.

## Table of Contents

- [1. Tổng quan](#1-tổng-quan)
- [2. Công nghệ và kiến trúc](#2-công-nghệ-và-kiến-trúc)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
- [4. Vai trò và phân quyền](#4-vai-trò-và-phân-quyền)
- [5. Mô hình dữ liệu và RPC](#5-mô-hình-dữ-liệu-và-rpc)
- [6. Quy ước](#6-quy-ước)
- [7. Quyết định đã chốt và khác biệt so với SPEC](#7-quyết-định-đã-chốt-và-khác-biệt-so-với-spec)
- [8. Phạm vi P0 đã làm](#8-phạm-vi-p0-đã-làm)
- [9. Dữ liệu tồn đầu kỳ](#9-dữ-liệu-tồn-đầu-kỳ)
- [10. Chạy và kiểm thử trên máy](#10-chạy-và-kiểm-thử-trên-máy)
- [11. Triển khai production](#11-triển-khai-production)
- [12. Tiến độ và việc còn lại](#12-tiến-độ-và-việc-còn-lại)

## 1. Tổng quan

Web app (PWA) quản lý bán hàng, kho, công nợ nhà cung cấp, thu chi và lãi lỗ cho cửa hàng bán lẻ hàng nhập khẩu. Chạy trên Chrome máy tính tại quầy và cài được lên điện thoại như ứng dụng.

| Hạng mục | Giá trị |
|---|---|
| Production | https://sieuthiuc.vercel.app (project Vercel `sieuthiuc` đã tạo, chưa nối GitHub) |
| Mã nguồn | https://github.com/beyeu2601/sieuthiuc (public, không chứa dữ liệu kinh doanh) |
| Database | Supabase project `mmnfhppaupmvkdggekbz` (một môi trường duy nhất: production) |
| Phạm vi | Toàn bộ P0, một cửa hàng, schema sẵn sàng cho nhiều cửa hàng |

## 2. Công nghệ và kiến trúc

- Next.js 15 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui (bản Base UI). Form dùng select và checkbox gốc của trình duyệt.
- Supabase: PostgreSQL 17, Auth, RLS, các extension `pg_trgm`, `unaccent`, `pgcrypto`. Chưa dùng Storage, Realtime, Edge Functions.
- `@supabase/ssr` giữ session qua cookie; `src/middleware.ts` làm mới session và chuyển về `/login` khi chưa đăng nhập.
- Mọi logic thay đổi số liệu nghiệp vụ (tồn, giá vốn, công nợ, tiền ca, doanh thu) nằm trong hàm PostgreSQL. Client chỉ gọi RPC và hiển thị.
- Server Action của Next.js gọi RPC với phiên người dùng. Riêng tạo và sửa người dùng dùng service role ở server sau khi kiểm tra quyền.
- Máy quét mã vạch USB (Kiosk Việt) hoạt động như bàn phím: ô tìm sản phẩm nhận mã rồi Enter, khớp đúng một mã thì thêm ngay.
- Trên điện thoại, ô tìm ở màn Sản phẩm và Tra cứu có nút quét mã bằng camera sau (`@zxing/browser`, chỉ tải khi bấm nút). Cần HTTPS và quyền camera.
- In hóa đơn 80mm và tem mã vạch bằng trang in của trình duyệt. Chưa làm ESC/POS, QZ Tray, ngăn kéo tiền.
- Giao diện theo bộ nhận diện trong `docs/THUONG-HIEU.md`: màu, font, logo, khung điều hướng (thanh bên trên máy tính, tab dưới đáy trên điện thoại), chế độ tối.
- Bộ lọc màn Sản phẩm và các báo cáo dùng `AutoSubmitForm`: đổi ô chọn là lọc ngay, ô chữ gửi bằng Enter. Trên điện thoại (dưới `md`), bảng nhiều cột hiện thành danh sách thẻ.

## 3. Cấu trúc thư mục

```
src/app/login                    Đăng nhập bằng username
src/app/(app)/[store]/...        Màn hình theo cửa hàng: pos, sales, shifts, orders, receipts, inventory,
                                 lookup, expiry, transfers, payables, cash, reconcile, reports
src/app/(app)/products           Danh mục sản phẩm, gợi ý giá, import Excel
src/app/(app)/suppliers          Nhà cung cấp
src/app/(app)/settings           Cửa hàng, người dùng, cấu hình, nhóm hàng, thành viên
src/app/(app)/account            Đổi mật khẩu, mã PIN quản lý
src/app/print                    In hóa đơn 80mm, in tem mã vạch
src/components                   Thành phần dùng chung (app-shell, product-picker, money-input, ...), ui = shadcn
public/brand                     Logo đã tách nền; sinh lại bằng scripts/brand-assets.py
src/lib                          auth, roles, nav, errors, format, dates, settings, text, supabase clients
supabase/migrations              SQL theo thứ tự thời gian
supabase/tests                   Test pgTAP; include/setup.sql là dữ liệu mẫu dùng chung
scripts                          bootstrap, import-kho, db-test (DB thật), local-db-test (PGlite)
```

## 4. Vai trò và phân quyền

| Vai trò (`app_role`) | Nhãn | Phạm vi |
|---|---|---|
| `sadmin` | Quản trị hệ thống | Mọi cửa hàng, người dùng, cấu hình chung |
| `admin` | Quản lý cửa hàng | Toàn quyền trong cửa hàng được gán (vai trò "Chủ tiệm" của SPEC trong phạm vi cửa hàng) |
| `accountant` | Kế toán | Cửa hàng được gán; công nợ, thu chi, đối soát, báo cáo; không bán hàng, không sửa sản phẩm |
| `staff` | Nhân viên | Cửa hàng được gán; bán hàng, ca, nhập hàng nháp, đơn online, tra cứu, chi tiền mặt trong ca |

Cơ chế:

- Quyền đọc từ bảng `profiles` và `user_stores` qua các hàm `SECURITY DEFINER`: `auth_role()`, `auth_store_ids()`, `can_access_store()`, `is_store_manager()`, `auth_has_perm()`, `assert_role()`. Đổi quyền có hiệu lực ở request kế tiếp.
- RLS bật trên mọi bảng. SELECT qua RLS, ghi dữ liệu nghiệp vụ chỉ qua RPC.
- Nhân viên không đọc được giá vốn: bảng `products`, `inventory`, `stock_lots`, `stock_movements` chặn nhân viên; nhân viên dùng RPC `catalog_search`, `inventory_status`, `lot_expiry`, `stock_movement_list`, `catalog_by_ids` (các cột giá vốn trả về rỗng). Cột `sales.cogs_total`, `sale_items.unit_cost/cogs` và `profiles.pos_pin_hash` bị chặn bằng quyền theo cột.
- Quyền mở rộng cá nhân: `profiles.extra_permissions.confirm_receipt` cho nhân viên được xác nhận phiếu nhập.
- `protect_last_sadmin` chặn hạ quyền hoặc khóa sadmin cuối cùng. Admin chỉ tạo và sửa được tài khoản kế toán, nhân viên trong cửa hàng mình.

## 5. Mô hình dữ liệu và RPC

| Migration | Nội dung chính |
|---|---|
| `20260925000001` | Enum SPEC 6.1 (thêm `sadmin`, `admin`, `opening`), trigger `set_updated_at` |
| `20260925000002` | Cửa hàng, hồ sơ, gán cửa hàng, cấu hình, mã chứng từ, audit, hàm phân quyền |
| `20260925000003` | Nhóm hàng, thương hiệu, sản phẩm, mã vạch, lịch sử giá |
| `20260925000004` | Tồn, lô, biến động; `import_opening_stock` |
| `20260925000005` | Cấu hình mặc định Phụ lục A |
| `20260926000001` | Tìm không dấu, giá % Benefit, gợi ý giá, mã vạch nội bộ EAN-13, `catalog_search`, nhà cung cấp, hạng thành viên, `import_products` |
| `20260927000001` | Phiếu nhập, landed cost, WAVG (`_receive_stock`), `_apply_movement`, công nợ, thanh toán, chuyển kho, báo cáo tồn |
| `20260928000001` | Ca, bán hàng (`_post_sale`, `complete_sale`, `cancel_sale`), PIN duyệt giảm giá |
| `20260929000001` | Đơn online giữ hàng, công nợ, thu chi, đối soát, báo cáo lãi lỗ, giá vốn, bán chạy |

Các RPC chính theo nghiệp vụ:

- Bán hàng: `complete_sale` (idempotent theo khóa, giá lấy từ DB, FEFO, khóa tồn theo thứ tự sản phẩm), `cancel_sale`, `request_discount_approval`.
- Ca: `open_shift`, `close_shift`, `approve_shift`, `adjust_shift_count`, `shift_expected_cash`, `shift_summary`.
- Kho: `save_purchase_receipt`, `confirm_purchase_receipt`, `cancel_purchase_receipt`, `save_transfer`, `send_transfer`, `receive_transfer`, `cancel_transfer`.
- Đơn online: `create_order`, `update_order_status` (giao thành công tạo giao dịch bán theo kênh), `reconcile_reservations`.
- Tài chính: `record_supplier_payment`, `debt_overview`, `create_cash_transaction`, `review_cash_transaction`, `mark_cash_transaction_paid`, `reconcile_report`, `save_reconciliation_note`.
- Báo cáo: `pnl_report`, `pnl_daily`, `revenue_breakdown`, `cogs_report`, `expense_report`, `best_sellers`, `inventory_status`, `inventory_period`, `lot_expiry`, `stock_movement_list`.

## 6. Quy ước

- Tiền `bigint` VND, số lượng `numeric(12,3)`. Hiển thị `1.234.567 ₫`, ngày `dd/MM/yyyy`, múi giờ `Asia/Ho_Chi_Minh`.
- Mã chứng từ: `{PREFIX}-{MÃ CỬA HÀNG}-{YYMMDD}-{4 số}`. SKU `SP-000001`, nhà cung cấp `NCC-0001`.
- `sales.subtotal` là tiền hàng trước mọi giảm giá; `sales.discount_amount` gồm giảm theo dòng và giảm cả đơn; `total = subtotal - discount_amount`. Lãi lỗ tính Doanh thu gộp = Σ subtotal, Giảm giá = Σ discount_amount, nên doanh thu thuần khớp SPEC 7.6.
- RPC báo lỗi bằng `RAISE EXCEPTION`: thông điệp tiếng Việt ở `message`, mã lỗi (`FORBIDDEN`, `VALIDATION`, `INSUFFICIENT_STOCK`, `EXPIRED_LOT`, `DISCOUNT_LIMIT`, `PAYMENT_MISMATCH`, `DEBT_OVERPAY`, `SHIFT_NOT_OPEN`...) ở `hint`. `src/lib/errors.ts` chuyển thành câu cho người dùng.
- Hàm mới: `set search_path = ''`, kiểm tra quyền ở đầu hàm, `revoke execute ... from public, anon`, kèm test pgTAP.

## 7. Quyết định đã chốt và khác biệt so với SPEC

Quyết định của khách ngày 25/09/2026:

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Mobile | PWA, không đăng App Store / Play Store |
| 2 | Môi trường | Một Supabase project production duy nhất |
| 3 | Số cửa hàng | Một cửa hàng; schema giữ `store_id` |
| 4 | Vai trò | sadmin, admin, accountant, staff |
| 5 | Hạng thành viên | Mặc định SPEC, admin chỉnh được |
| 6 | Hóa đơn điện tử | Có nghĩa vụ nhưng chưa làm giai đoạn này |
| 7 | Phạm vi | Làm hết P0 trước |
| 8 | Đăng nhập | Username; email nội bộ `<username>@sieuthiuc.local` |
| 9 | Thiết bị | Chrome; máy quét USB Kiosk Việt; chưa làm máy in nhiệt, ngăn kéo |
| 10 | Mạng | Ổn định; offline POS giữ ở P2 |
| 11 | Shopee | Nhập đơn thủ công, chưa tích hợp API |
| 12 | Loại hàng | Mặt hàng nhập theo cả Cont và Air là hai mã sản phẩm riêng; loại hàng là một thuộc tính thường của sản phẩm |

Khác biệt kỹ thuật so với SPEC:

- Không dùng custom JWT claims và Auth Hook; quyền đọc trực tiếp từ bảng.
- Tạo người dùng bằng Server Action dùng service role, thay cho Edge Function `admin-create-user`.
- `settings` dùng `unique nulls not distinct (key, store_id)` (cú pháp khóa chính của SPEC không hợp lệ).
- RPC trả lỗi bằng exception thay cho JSON `{ok, data, error}` để giao dịch luôn rollback trọn vẹn.
- Giá bán tại quầy luôn lấy từ DB, bỏ qua giá client gửi lên. Đơn online dùng giá nhập trên đơn.
- Duyệt giảm giá vượt hạn mức: quản lý nhập PIN để nhận mã duyệt dùng một lần trong 5 phút; sai 3 lần trong 1 phút khóa 1 phút. Tách bước để số lần sai không bị rollback.
- Phí ship của đơn online không vào doanh thu (sale ghi tiền hàng trừ giảm giá).
- Công nợ, thu chi, đối soát, báo cáo đặt dưới đường dẫn cửa hàng `/[store]/...`; báo cáo có tùy chọn "Tất cả cửa hàng" khi người dùng có nhiều cửa hàng.
- Duyệt khoản chi (P1) làm sớm ở dạng đơn giản: chỉ khoản chi tiền mặt của nhân viên vượt ngưỡng `expense.auto_approve_below` mới chờ duyệt.
- Giỏ hàng POS lưu localStorage thay cho Dexie.

## 8. Phạm vi P0 đã làm

| Module | Tính năng |
|---|---|
| Bán hàng | POS quét mã, giảm giá dòng và đơn, hạn mức giảm giá + PIN quản lý, thanh toán nhiều phương thức, tiền thối, in hóa đơn 80mm, hủy giao dịch, lịch sử |
| Đơn online | Tạo đơn Shopee/Facebook/khác, giữ hàng, đang giao, giao thành công ghi doanh thu, hủy trả khả dụng |
| Sản phẩm | CRUD, mã vạch nhà sản xuất và nội bộ, mã lốc, giá trực tiếp hoặc % Benefit, gợi ý giá, lịch sử giá, import Excel, in tem, tra cứu, hạn sử dụng |
| Kho | Phiếu nhập nháp/xác nhận, chi phí kèm theo phân bổ, giá vốn bình quân, lô và HSD, tồn hiện tại, nhập xuất tồn theo kỳ, cần nhập thêm, lịch sử biến động, chuyển kho |
| Công nợ | Tự sinh từ phiếu nhập, hạn theo nhà cung cấp, tổng quan, theo NCC, cần thanh toán, thanh toán phân bổ nhiều khoản, lịch sử số dư trước/sau |
| Thu chi và lãi lỗ | Ghi thu chi, phải trả khác, đối soát tiền mặt theo ca và sao kê nhập tay, lãi lỗ 2 tầng có so sánh kỳ trước, giá vốn và lãi gộp theo sản phẩm/nhóm/kênh/loại hàng |
| Ca | Mở ca, chốt ca đếm theo mệnh giá, tiền kỳ vọng, chênh lệch, cần kiểm tra khi vượt ngưỡng, duyệt, sửa số đếm có lý do |
| Cấu hình | Người dùng và phân quyền, thông tin cửa hàng, tham số vận hành, nhóm hàng, thương hiệu, hạng thành viên |

## 9. Dữ liệu tồn đầu kỳ

Nguồn: `kho hang.xlsx` (không đưa lên GitHub). Script: `scripts/import-kho.mjs`.

- Đọc hai sheet `AIR` và `CONT`. Không dùng sheet `TỔNG` vì tổng tồn không khớp.
- Ô gộp theo cột được đọc lại đúng giá trị ô đầu vùng gộp.
- Dòng nhóm (có tên, không có số lượng) không phải sản phẩm; dòng con đặt tên `<tên nhóm> - <tên con>`.
- Tồn = cột "CÒN LẠI". Tồn âm đưa về 0 và ghi chú. Giá vốn dạng chữ đưa về 0, giữ chữ trong ghi chú.
- Tên trùng trong cùng loại hàng được thêm `- <ĐVT>`.
- Mỗi sản phẩm có tồn tạo lô `TONDAU` không hạn dùng và biến động `opening`. Chỉ import được một lần cho mỗi cửa hàng.

Chạy thử không ghi DB: `npm run import:kho -- --dry-run`, kết quả ở `data/import-preview.json`.

## 10. Chạy và kiểm thử trên máy

```
npm install
cp .env.example .env.local      # điền giá trị
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint
npm run db:test:local           # áp toàn bộ migration + chạy pgTAP trên PGlite, không cần Docker
npm run db:test                 # chạy pgTAP trên database thật (cần SUPABASE_DB_URL)
```

`db:test:local` giả lập schema `auth` và các vai trò của Supabase. Nó không thay thế việc chạy `db:test` trên database thật sau khi `supabase db push`.

## 11. Triển khai production

Khi có migration mới:

```
supabase link --project-ref mmnfhppaupmvkdggekbz
supabase db push                # áp dụng migration
supabase config push            # tắt đăng ký công khai, mật khẩu tối thiểu 8
npm run db:test                 # phải đạt trước khi deploy app
git push origin main            # Vercel tự build khi đã nối GitHub
```

Khởi tạo lần đầu (một lần):

```
npm run bootstrap -- --store-code SU --store-name "Siêu Thị Úc" --username <ten> --full-name "<Họ tên>"
npm run import:kho -- --store SU
```

Biến môi trường trên Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (bắt buộc cho màn hình quản lý người dùng; chỉ dùng ở server).

## 12. Tiến độ và việc còn lại

| Sprint | Trạng thái |
|---|---|
| 0 - Khung, phân quyền, cấu hình, audit | Xong, test đạt trên PGlite |
| 1 - Sản phẩm, giá, NCC, người dùng, cài đặt | Xong, test đạt trên PGlite |
| 2 - Phiếu nhập, giá vốn, kho, chuyển kho | Xong, test đạt trên PGlite |
| 3 - Ca, POS, in hóa đơn, hủy | Xong, test đạt trên PGlite |
| 4 - Đơn online, công nợ, thu chi, đối soát, báo cáo | Xong, test đạt trên PGlite |
| Áp migration lên Supabase, bootstrap, import, deploy | Chờ quyền truy cập Supabase và kết nối Vercel với GitHub |

Việc còn lại đã biết:

- Khóa đăng nhập sau 5 lần sai (SPEC mục 17): hiện dựa vào giới hạn tần suất của Supabase Auth.
- Đính kèm chứng từ (Storage) cho phiếu nhập, thu chi, thanh toán.
- Cập nhật tồn thời gian thực trên POS (Realtime): hiện RPC kiểm tra tồn lần cuối khi thanh toán và báo lỗi nếu vượt.
- Test đồng thời hai phiên bán cùng món cuối: logic khóa dòng có sẵn, cần chạy trên database thật.
- P1: thành viên và tích điểm tại POS, hoàn trả, kiểm kê, điều chỉnh và hủy hàng, thông báo, export Excel/PDF, màn hình audit log.
- P2: đồng bộ Shopee, hóa đơn điện tử, offline POS, in Bluetooth, FIFO.
