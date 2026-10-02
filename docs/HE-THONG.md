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
- [13. Ảnh sản phẩm trên Google Drive](#13-ảnh-sản-phẩm-trên-google-drive)

## 1. Tổng quan

Web app (PWA) quản lý bán hàng, kho, công nợ nhà cung cấp, thu chi và lãi lỗ cho cửa hàng bán lẻ hàng nhập khẩu. Chạy trên Chrome máy tính tại quầy và cài được lên điện thoại như ứng dụng.

| Hạng mục | Giá trị |
|---|---|
| Production | https://sieuthiuc.vercel.app (project Vercel `sieuthiuc` đã nối GitHub, tự build khi push lên `main`) |
| Mã nguồn | https://github.com/beyeu2601/sieuthiuc (public, không chứa dữ liệu kinh doanh) |
| Database | Supabase project `mmnfhppaupmvkdggekbz` (một môi trường duy nhất: production) |
| Phạm vi | Toàn bộ P0, một cửa hàng, schema sẵn sàng cho nhiều cửa hàng |

## 2. Công nghệ và kiến trúc

- Next.js 15 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui (bản Base UI). Form dùng select và checkbox gốc của trình duyệt.
- Supabase: PostgreSQL 17, Auth, RLS, các extension `pg_trgm`, `unaccent`, `pgcrypto`. Chưa dùng Storage, Realtime, Edge Functions.
- Ảnh sản phẩm lưu trên Google Drive của chủ cửa hàng, thư mục `sieuthiuc` (xem mục 13).
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
| `20260930000001` | Ảnh sản phẩm: `product_images`, `add_product_image`, `set_product_thumbnail`, `delete_product_image` |
| `20261001000001` | Tài khoản giữ tiền: `money_accounts`, `manage_money_account`, `money_account_balances`, cột `account_id` cho thu chi/thanh toán bán và NCC; giá bán trên dòng phiếu nhập (`purchase_receipt_items.sell_price`) cập nhật giá bán khi xác nhận |
| `20261002000001` | Giá cận date: enum `product_date_type` và cột `products.date_type` (short/long); cấu hình `expiry.short_date_days` (15), `expiry.long_date_days` (60), `expiry.markup_vnd` (50000); `lot_expiry` dùng ngưỡng theo loại date và trả thêm `date_type`, `near_days`, `suggested_price` |
| `20261004000001` | Tìm sản phẩm linh hoạt: `catalog_search` tách câu tìm thành các từ, yêu cầu mọi từ đều có trong `search_key` (không cần đúng thứ tự); vẫn ưu tiên khớp mã vạch và SKU |
| `20261005000001` | Nhập nhiều HSD cho một mặt hàng trong cùng phiếu: `confirm_purchase_receipt` tự đặt số lô `{mã phiếu}-1`, `{mã phiếu}-2`... cho các dòng cùng sản phẩm để trống số lô, mỗi HSD thành một lô riêng |
| `20261007000001` | Chỉnh trực tiếp tồn kho và giá vốn: `adjust_product_stock` (sadmin/admin của cửa hàng) |
| `20261008000001` | Đối soát tiền Shopee và hoàn hàng: bảng `platform_payouts`, cột `orders.payout_id`, `orders.return_*`, `cash_transactions.payout_id`; nhóm chi `Phí sàn Shopee`, `Quảng cáo Shopee`; `record_platform_payout`, `cancel_platform_payout`, `return_order`, `review_order_return` |

Các RPC chính theo nghiệp vụ:

- Bán hàng: `complete_sale` (idempotent theo khóa, giá lấy từ DB, FEFO, khóa tồn theo thứ tự sản phẩm), `cancel_sale`, `request_discount_approval`.
- Ca: `open_shift`, `close_shift`, `approve_shift`, `adjust_shift_count`, `shift_expected_cash`, `shift_summary`.
- Kho: `adjust_product_stock`, `save_purchase_receipt`, `confirm_purchase_receipt`, `cancel_purchase_receipt`, `save_transfer`, `send_transfer`, `receive_transfer`, `cancel_transfer`.
- Đơn online: `create_order`, `update_order_status` (giao thành công tạo giao dịch bán theo kênh), `reconcile_reservations`, `return_order`, `review_order_return`, `record_platform_payout`, `cancel_platform_payout`.
- Tài chính: `record_supplier_payment`, `debt_overview`, `create_cash_transaction`, `review_cash_transaction`, `mark_cash_transaction_paid`, `reconcile_report`, `save_reconciliation_note`.
- Báo cáo: `pnl_report`, `pnl_daily`, `revenue_breakdown`, `cogs_report`, `expense_report`, `best_sellers`, `inventory_status`, `inventory_period`, `lot_expiry`, `stock_movement_list`.

## 6. Quy ước

- Tiền `bigint` VND, số lượng `numeric(12,3)`. Hiển thị `1.234.567 ₫`, ngày `dd/MM/yyyy`, múi giờ `Asia/Ho_Chi_Minh`.
- Mã chứng từ: `{PREFIX}-{MÃ CỬA HÀNG}-{YYMMDD}-{4 số}`. SKU `SP-000001`, nhà cung cấp `NCC-0001`.
- `sales.subtotal` là tiền hàng trước mọi giảm giá; `sales.discount_amount` gồm giảm theo dòng và giảm cả đơn; `total = subtotal - discount_amount`. Lãi lỗ tính Doanh thu gộp = Σ subtotal, Giảm giá = Σ discount_amount, nên doanh thu thuần khớp SPEC 7.6.
- RPC báo lỗi bằng `RAISE EXCEPTION`: thông điệp tiếng Việt ở `message`, mã lỗi (`FORBIDDEN`, `VALIDATION`, `INSUFFICIENT_STOCK`, `EXPIRED_LOT`, `DISCOUNT_LIMIT`, `PAYMENT_MISMATCH`, `DEBT_OVERPAY`, `SHIFT_NOT_OPEN`...) ở `hint`. `src/lib/errors.ts` chuyển thành câu cho người dùng.
- Hàm mới: `set search_path = ''`, kiểm tra quyền ở đầu hàm, `revoke execute ... from public, anon`, kèm test pgTAP.

Thành phần giao diện dùng chung (đợt nâng UX/UI 09/2026, chi tiết thiết kế ở `docs/THUONG-HIEU.md`). Dùng lại trước khi tự viết:

| Việc | Dùng | Ghi chú |
|---|---|---|
| Tô màu trạng thái, kênh, loại hàng | `src/components/ui/chip.tsx` (`ChipSac` + helper theo miền) | Không tô màu thủ công ở trang, không ghi mã hex ngoài `globals.css` |
| Đang tải | `loading.tsx` + `SkeletonTrang` hoặc `Skeleton` | Khung phải có `aria-busy` |
| Không có dữ liệu | `EmptyState` (`icon`, `action`) | |
| Nút quay lại | `PageHeader` (`back`) hoặc `BackButton` | Mọi màn trừ Tổng quan đều có. Truyền `back` khi cần về màn cha cố định; bỏ trống thì quay về màn vừa xem, mở thẳng bằng link thì về Tổng quan |
| Hỏi xác nhận | `useConfirm()` trả `{ confirm, dialog }`, render `{dialog}` | Không dùng `confirm()` của trình duyệt |
| Báo kết quả | `src/lib/feedback.ts` (`baoTheoKetQua`) | |
| Thẻ chỉ số | `KpiCard` + `HangKpi` | Là Link sang màn chi tiết |
| Tiến độ x/y | `ThanhTienDo` | Luôn in kèm số x/y |
| Biểu đồ | `DailyBars`, `charts/thanh-co-cau.tsx` (`ThanhCoCau`) | Không thêm thư viện biểu đồ |
| Bảng trên điện thoại | `MobileCardList` + `MobileCard`, bảng bọc `hidden md:block` | |
| Phân trang | `Pagination` qua `?page=` | Số dòng mỗi trang cố định ở server (`PAGE_SIZE`) |
| Hộp thoại | `DialogContent` > `DialogHeader` / `DialogBody` / `DialogFooter` | Chỉ `DialogBody` cuộn; nằm trong `<form>` thì form `flex min-h-0 flex-col` |
| Form nhiều bước | `FormWizard` (+ `Stepper`) | Mọi bước đều mount; đang dùng ở phiếu nhập |
| Thanh dính đáy | `sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0` | Tránh bị tab dưới đáy điện thoại che |
| Chuyển động | tiện ích `tw-animate-css` với `motion-safe:` | Không viết keyframes riêng |

Phiếu nhập (mới và sửa nháp) đi theo 4 bước: Nhà cung cấp -> Hàng nhập -> Chi phí -> Kiểm tra. "Lưu nháp" có ở mọi bước; phiếu nháp mở lại vào thẳng bước Kiểm tra. Thanh toán và hạn nợ vẫn chọn ở hộp thoại Xác nhận nhập kho vì RPC xác nhận cần phiếu đã lưu. Ô tìm sản phẩm (`ProductPicker`) nhận phím lên/xuống và Enter chọn dòng đang sáng; khi chưa chọn dòng nào, Enter vẫn tìm và tự chọn khi khớp đúng mã (máy quét không đổi).

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
- Thanh toán POS bắt buộc chọn phương thức (bỏ mặc định tiền mặt toàn bộ khi để trống).
- Tài khoản giữ tiền (két, ngân hàng, ví) do sadmin quản lý ở Cài đặt > Tài khoản tiền. Thu chi, thu bán hàng (từng phương thức) và trả NCC đều chọn tài khoản để theo dõi số dư; `account_id` là tùy chọn ở RPC (validate khi có), bắt buộc chọn ở giao diện.
- Phiếu nhập có cột giá bán mỗi dòng và nút "Thêm sản phẩm" tạo nhanh (sadmin/admin); xác nhận nhập kho cập nhật giá bán sản phẩm (ghi lịch sử giá) khi dòng có nhập giá bán khác giá cũ.
- Màn Thêm sản phẩm có ô Giá vốn (không bắt buộc, ghi vào `products.cost_price_ref`) để có giá vốn tham chiếu trước lần nhập hàng đầu; dùng luôn cho % Benefit. Giá vốn sửa sau ở khối "Tồn kho và giá vốn" của trang sản phẩm; phiếu nhập xác nhận sẽ ghi đè bằng giá vốn bình quân.
- Chỉnh tồn kho và giá vốn không qua phiếu nhập (khách yêu cầu 01/10/2026): trang chi tiết sản phẩm có khối "Tồn kho và giá vốn" theo từng cửa hàng (sadmin/admin). Nhập số tồn thực tế: tăng thì tạo lô mới `DC-yymmddhhmmss` theo giá vốn hiện tại (HSD tùy chọn), giảm thì trừ lô theo FEFO; biến động loại `adjustment`, không phát sinh công nợ NCC. Không cho thấp hơn số đang giữ cho đơn online. Sửa giá vốn ghi đè `inventory.avg_cost`, giá vốn các lô còn hàng và `products.cost_price_ref`; giao dịch bán đã ghi giữ nguyên giá vốn cũ; sản phẩm đặt giá theo % Benefit không tự đổi giá bán (xem Gợi ý giá).
- Phiếu nhập có nút "Thêm NCC" cạnh ô chọn nhà cung cấp (sadmin/admin/kế toán): tạo nhanh NCC (tên, điện thoại, số ngày được nợ), mã NCC tự sinh, tạo xong tự chọn vào phiếu.
- Tìm sản phẩm ở ô tra cứu/phiếu nhập nhận nhiều từ khóa rời: gõ "yến mạch 500gr" vẫn ra "Yến Mạch Uncle 500gr" vì mọi từ đều phải khớp `search_key` nhưng không cần liền nhau hay đúng thứ tự.
- Nhóm hàng bỏ cấu hình % Benefit ở giao diện; sản phẩm đặt giá theo % Benefit dùng % riêng. Hạng thành viên tạm ẩn khỏi Cài đặt (trang `/settings/loyalty` vẫn còn).
- Thanh bên trên máy tính có thể ẩn/hiện, lưu lựa chọn trong localStorage.
- Nhập một mặt hàng nhiều hạn dùng trong cùng một phiếu: trên màn phiếu nhập bấm "+ Thêm lô/date khác" để tạo thêm dòng cho cùng sản phẩm (SL/lô/HSD nhập riêng, chép sẵn đơn giá và giá bán). Khi xác nhận, các dòng cùng sản phẩm để trống số lô được tự đặt số lô `{mã phiếu}-1`, `{mã phiếu}-2`... nên mỗi HSD thành một lô riêng; dòng đơn lẻ vẫn dùng số lô mặc định là mã phiếu. Quét lại cùng mã vạch vẫn cộng dồn vào dòng đầu.
- Tiền Shopee (khách yêu cầu 02/10/2026): Shopee trả theo đợt vào ngân hàng, gộp nhiều đơn, đã trừ phí sàn. Doanh thu vẫn ghi lúc giao thành công; đơn Shopee đã giao hiện "Chờ Shopee trả" và chưa vào số dư tài khoản nào. Màn Đơn online > Đối soát Shopee (sadmin/admin/kế toán): tick các đơn trong đợt, nhập số tiền thực nhận, tiền Shopee trừ nạp quảng cáo (nếu có), ngày và tài khoản. Tiền bán của các đơn gắn vào tài khoản; chênh lệch ghi khoản chi "Phí sàn Shopee", quảng cáo ghi "Quảng cáo Shopee"; nếu Shopee trả dư thì ghi "Thu khác". App không tự tính phí vì biểu phí Shopee thay đổi theo ngành hàng và chương trình. Cửa hàng là công ty TNHH nên không có dòng thuế sàn khấu trừ (chỉ áp cho hộ kinh doanh). sadmin/admin hủy được đợt nhập sai: đơn trở về chờ trả, khoản chi sinh từ đợt bị xóa.
- Hoàn hàng đơn online: đơn đã giao, chưa đối soát nhận tiền mới hoàn được (có lý do). Giao dịch bán bị hủy (bỏ doanh thu và giá vốn) nhưng hàng chưa vào kho; sadmin/admin kiểm hàng rồi chọn nhập lại kho (trả về đúng lô đã xuất) hoặc không nhập (hàng hỏng, có lý do). Hàng không nhập kho chưa được ghi vào lãi lỗ như khoản hao hụt.
- Giá cận date: mỗi sản phẩm gán loại date ngắn (ngưỡng 15 ngày) hoặc dài (ngưỡng 60 ngày), mặc định dài. Khi lô còn dưới ngưỡng, màn Hạn sử dụng đề xuất giá bán = giá vốn lô + phụ thu (mặc định 50.000₫); chỉ gợi ý, không tự ghi đè `products.sell_price`. Giá đề xuất ẩn với nhân viên (lộ giá vốn). sadmin sửa ngưỡng 15/60 và phụ thu ở Cài đặt > Cấu hình (nhóm "Cận date và giá giảm"); `inventory.near_expiry_days` không còn dùng cho màn này.

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
git push origin main            # Vercel tự build (đã nối GitHub). Webhook lỡ thì trigger tay trên Vercel
```

Khởi tạo lần đầu (một lần):

```
npm run bootstrap -- --store-code SU --store-name "Siêu Thị Úc" --username <ten> --full-name "<Họ tên>"
npm run import:kho -- --store SU
```

Biến môi trường trên Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (bắt buộc cho màn hình quản lý người dùng; chỉ dùng ở server), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` (ảnh sản phẩm).

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

## 13. Ảnh sản phẩm trên Google Drive

- Mỗi sản phẩm tối đa 10 ảnh, một ảnh đại diện hiện ở danh sách Sản phẩm. Ảnh đầu tiên tự thành ảnh đại diện; xóa ảnh đại diện thì ảnh còn lại đầu tiên thay thế. Chỉ sadmin, admin thêm, xóa, đổi ảnh đại diện; mọi người đăng nhập đều xem được.
- Trình duyệt thu nhỏ ảnh trước khi gửi: bản lớn cạnh dài tối đa 1600px và bản nhỏ vuông 400px, đều JPEG. Mỗi ảnh là hai file trên Drive (`<SKU>_<thời điểm>.jpg` và `..._nho.jpg`). DB chỉ giữ mã file.
- App dùng quyền `drive.file`: chỉ thấy file do chính app tạo, không đọc được phần còn lại của Drive. Vì vậy thư mục `sieuthiuc` phải do script tạo, không tạo tay.
- Ảnh hiển thị qua `/api/product-images/<mã file>` (cần đăng nhập), cache một năm vì file không bao giờ bị ghi đè. Xóa ảnh trong app chuyển file vào thùng rác Drive (khôi phục được 30 ngày).
- Thiếu biến môi trường Google thì màn chi tiết sản phẩm báo chưa kết nối, phần còn lại chạy bình thường.

Kết nối lần đầu (một lần):

1. Google Cloud Console: tạo project, bật Google Drive API.
2. OAuth consent screen: loại External, thêm scope `drive.file`, rồi bấm Publish app (để ở Testing thì refresh token hết hạn sau 7 ngày).
3. Credentials: tạo OAuth client ID loại Desktop app, ghi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` vào `.env.local`.
4. `npm run drive:setup`: đăng nhập tài khoản Google sẽ lưu ảnh; script tạo thư mục `sieuthiuc` và ghi `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` vào `.env.local`.
5. Thêm bốn biến trên vào Vercel rồi deploy lại.
