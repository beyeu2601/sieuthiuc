# Kế hoạch nâng cấp UX/UI Siêu Thị Úc

Học hỏi hệ thiết kế đã chín của dự án 26c Academy và áp dụng vào Siêu Thị Úc. Đây là đợt nâng cấp lớn, chia nhiều phase, làm nền tảng trước rồi lan ra từng màn hình. Đọc `docs/HE-THONG.md` và `docs/THUONG-HIEU.md` trước khi làm.

## Table of Contents

- [1. Bối cảnh và quyết định đã chốt](#1-bối-cảnh-và-quyết-định-đã-chốt)
- [2. Khoảng cách giữa SieuthiUc và 26c](#2-khoảng-cách-giữa-sieuthiuc-và-26c)
- [3. Bảng màu và ngữ nghĩa trạng thái (hợp đồng Phase 1)](#3-bảng-màu-và-ngữ-nghĩa-trạng-thái-hợp-đồng-phase-1)
- [4. Primitive mượn từ 26c](#4-primitive-mượn-từ-26c)
- [5. Tám phase](#5-tám-phase)
- [6. Ràng buộc bắt buộc cho mọi phase](#6-ràng-buộc-bắt-buộc-cho-mọi-phase)
- [7. Phân tích thiết kế toàn diện 8 yếu tố](#7-phân-tích-thiết-kế-toàn-diện-8-yếu-tố)
- [8. Cách chạy để tiết kiệm token](#8-cách-chạy-để-tiết-kiệm-token)

## 1. Bối cảnh và quyết định đã chốt

Hai dự án dùng chung nền công nghệ: Next.js App Router, Tailwind 4 (cấu hình bằng CSS trong `globals.css`), Base UI (`@base-ui/react`), `class-variance-authority`, `lucide-react`, `sonner`. Vì vậy pattern của 26c port sang SieuthiUc gần như không cần đổi API.

Quyết định của chủ dự án ngày 28/09/2026:

1. Màu: MỞ RỘNG bảng màu ngữ nghĩa như 26c. Giữ xanh thương hiệu `#324ca0` làm màu hành động chính (nút, liên kết, mục đang chọn), nhưng cho màu mang thêm nghĩa: mỗi trạng thái đơn/ca/phiếu/tồn/hạn/nợ một sắc cố định, mỗi kênh bán một sắc, mỗi loại hàng (Cont/Air) một sắc. Cập nhật lại `docs/THUONG-HIEU.md` mục 2 và mục 7 (quy tắc "chỉ một màu nhấn" đổi thành "một màu hành động, nhiều màu ngữ nghĩa").
2. Cách làm: NỀN TẢNG TRƯỚC. Phase 1-3 dựng và nâng primitive dùng chung, Phase 4-7 áp lần lượt vào từng nhóm màn hình, Phase 8 rà soát.
3. Phạm vi: TOÀN APP (~45 route). Không làm tính năng nghiệp vụ mới trong đợt này; chỉ nâng trình bày, trạng thái (tải/rỗng/lỗi), chuyển động, nhất quán, và mobile. Ngoại lệ: wizard phiếu nhập/đơn online ở Phase 7 có thể đổi luồng nhập cho gọn hơn nhưng không đổi RPC.

## 2. Khoảng cách giữa SieuthiUc và 26c

SieuthiUc đã có sẵn (không làm lại):

- Hệ token màu + dark mode đầy đủ trong `src/app/globals.css` (brand, foreground, card, destructive/success/warning + soft, chart, sidebar).
- Thang radius sinh từ `--radius`, font Be Vietnam Pro + Barlow Condensed, `.tabular-nums`.
- Shell chỉn chu: `src/components/app-shell.tsx` (sidebar thu gọn được, store picker, mobile bottom-bar + bottom-sheet), `src/lib/nav.ts` (RBAC), `command-palette.tsx` (Ctrl+K, tìm không dấu).
- Primitive Base UI chất lượng: `button`, `card`, `dialog`, `input`, `table`, `badge`, `sonner`, `tabs`, `dropdown-menu`, `native-select`.
- Pattern nghiệp vụ tốt: `mobile-card`, `product-picker`, `money-input`, `page-header`, `filter-chip`, `auto-submit-form`, `theme`.

SieuthiUc còn thiếu so với 26c (trọng tâm đợt này):

- Không có bất kỳ `loading.tsx`/`error.tsx` nào; không có Skeleton; điều hướng giữa trang server thấy trắng màn hình.
- Gần như không có chuyển động ở tầng trang; `tw-animate-css` đã import nhưng gần như không dùng.
- `empty-state.tsx` chỉ có icon Inbox cố định, không CTA, không tùy biến icon; POS còn tự viết `<p>` thay vì dùng.
- Còn dùng `confirm()` gốc trình duyệt (`pos-client.tsx` khi xóa giỏ).
- `pagination.tsx` chỉ prev/next, không số trang, không đổi pageSize.
- `card.tsx` ít được dùng; nhiều trang lặp `rounded-xl border bg-card p-4`, bo góc không nhất quán (chỗ `rounded-xl`, chỗ `rounded-2xl`).
- Trạng thái nghiệp vụ (đơn, ca, phiếu, tồn, hạn, nợ) tô màu rải rác, chưa có hệ chip ngữ nghĩa dùng chung.
- Báo cáo (`reports`) trên mobile cuộn ngang, chưa có biến thể thẻ; data-viz chỉ có một biểu đồ cột tự viết (`daily-bars.tsx`), cơ cấu doanh thu/chi phí đang là danh sách phần trăm dạng chữ.
- `product-picker` dropdown chưa điều hướng bàn phím (arrow keys) như command palette.

## 3. Bảng màu và ngữ nghĩa trạng thái (hợp đồng Phase 1)

Đây là hợp đồng của Phase 1. Các phase sau chỉ gọi tên token/chip, không tự chọn mã hex. Kiến trúc ba lớp như 26c, khai trong `src/app/globals.css`:

- Lớp 1 - thang thô: `brand` (giữ xanh logo), `emerald`, `amber`, `rose`, `red`, `sky`, `indigo`, `purple`, `slate`. Chỉ khai bậc thực sự dùng.
- Lớp 2 - bộ ba chip `nen`/`chu`/`vien` cho từng sắc. Đây là lớp duy nhất có bản dark riêng (bậc 100 làm nền trên nền tối thì chữ chìm). Đo và ghi tương phản từng cặp nền-chữ ngay trong comment, tối thiểu 4.5:1.
- Lớp 3 - token nền trang: giữ nguyên bộ hiện có (`--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`, `--input`).

Giữ `brand = #324ca0` (xanh logo) làm màu HÀNH ĐỘNG: nút chính, liên kết, mục đang chọn, focus ring. Khác 26c (đổi brand sang blue Tailwind) - SieuthiUc giữ nhận diện kangaroo.

`rose` (cảnh báo nhẹ, cận date sắp tới) và `red` (cảnh báo tiền/hết hạn/hủy) là hai thang KHÁC NHAU, cố ý không gộp.

Ánh xạ nghĩa -> sắc cho ngành bán lẻ:

| Miền | Trạng thái | Sắc |
| :---- | :---- | :---- |
| Đơn online | Giữ hàng | indigo |
| Đơn online | Đang giao | sky |
| Đơn online | Giao thành công | emerald |
| Đơn online | Hủy | red |
| Ca | Đang mở | emerald |
| Ca | Đã chốt (chờ duyệt) | amber |
| Ca | Đã duyệt | brand |
| Ca | Cần kiểm tra (lệch vượt ngưỡng) | red |
| Phiếu nhập / chuyển kho | Nháp | slate |
| Phiếu nhập / chuyển kho | Đang chuyển / chờ xác nhận | amber |
| Phiếu nhập / chuyển kho | Đã xác nhận / đã nhận | emerald |
| Phiếu nhập / chuyển kho | Hủy | red |
| Tồn kho | Đủ | slate (trung tính) |
| Tồn kho | Thấp (cần nhập) | amber |
| Tồn kho | Hết | red |
| Hạn sử dụng | Còn hạn | slate |
| Hạn sử dụng | Cận date | amber |
| Hạn sử dụng | Hết hạn | red |
| Công nợ | Đã trả | emerald |
| Công nợ | Còn nợ | red (badge số tiền) |
| Công nợ | Quá hạn | red đậm |
| Lãi lỗ | Lãi / số dương | emerald |
| Lãi lỗ | Lỗ / số âm | red |
| Kênh bán | Tại quầy (POS) | brand |
| Kênh bán | Shopee | amber |
| Kênh bán | Facebook | sky |
| Kênh bán | Khác | slate |
| Loại hàng | Cont | indigo |
| Loại hàng | Air | sky |

Nhóm hàng và nhãn tự do (không có nghĩa cố định): dùng hàm băm `sacTheoNhan` để một tên luôn ra một sắc ổn định giữa các lần tải, thay vì băm ngẫu nhiên.

Việc bắt buộc kèm theo:

- Mỗi thang phải có bản dark. Khuôn chung: nền lấy bậc 900/950 giảm bão hòa, chữ bậc 200/300, viền bậc 700/800.
- Khối `@media print` trong `globals.css` ép về bản sáng cho cả `.dark` (hóa đơn/tem in ra không được lem màu).
- Trạng thái luôn đi kèm chữ hoặc icon, không chỉ dựa màu (giữ nguyên nguyên tắc a11y hiện có).
- Không hardcode hex ngoài `globals.css`.

## 4. Primitive mượn từ 26c

Port hoặc nâng, đặt trong `src/components/ui/` (theo quy ước hiện tại của SieuthiUc):

| Primitive | Nguồn 26c | Ghi chú áp dụng |
| :---- | :---- | :---- |
| `chip.tsx` | `chip.tsx` | `ChipSac` (bộ ba nen/chu/vien) + helper theo miền: `ChipTrangThaiDon`, `ChipTrangThaiCa`, `ChipTrangThaiPhieu`, `ChipTonKho`, `ChipHan`, `sacKenhBan`, `sacLoaiHang`, `sacTheoNhan`. Viết thẳng chuỗi class (Tailwind quét text). Thay dần cách tô màu rải rác và một phần `badge`. |
| `skeleton.tsx` + `skeleton-trang.tsx` | như tên | `SkeletonTrang(soThe)` cho các `loading.tsx`. |
| `kpi-card.tsx` | `kpi-card.tsx` | `KpiCard` + `HangKpi`: sắc ngữ nghĩa, bấm-để-lọc (`aria-pressed`, ring khi chọn), biến động %, skeleton. |
| `thanh-tien-do.tsx` | như tên | Progress bar x/y, dùng cho đếm tiền ca, mức tồn, tiến độ nhập. |
| `confirm-dialog.tsx` | `confirm-dialog.tsx` | Thay `confirm()` gốc. |
| `stepper.tsx` + `form-wizard.tsx` | như tên | Wizard mount-all cho form phức tạp (Phase 7). |
| `feedback.ts` | `feedback.ts` | Chuẩn hóa toast: `baoThanhCong`, `baoLoi`, `baoTheoTrangThai` bọc `sonner` + `src/lib/errors.ts` sẵn có. |
| Nâng `dialog.tsx` | `dialog.tsx` | Ba tầng: header đứng yên, body cuộn, footer luôn thấy (form dài không đẩy nút Lưu khỏi màn). |
| Nâng `empty-state.tsx` | pattern inline 26c | Nhận `icon` tùy biến + `action` (CTA). |
| Nâng `pagination.tsx` | - | Thêm số trang, pageSize, đầu/cuối; giữ cơ chế query string. |
| `bar-chart` + donut/stacked | `charts/bar-chart.tsx` | Tự dựng bằng SVG/CSS + token, kèm `<table class="sr-only">`. Không thêm thư viện chart (giữ bundle nhẹ như cả hai dự án đang theo). |

Không port `DataTable` (@tanstack/react-table) và `cmdk`: SieuthiUc đã có pattern server component + `AutoSubmitForm` + `MobileCard` và `command-palette` riêng chạy tốt. Giữ, chỉ mở rộng `MobileCard` sang các bảng còn cuộn ngang.

## 5. Tám phase

| Phase | Mục tiêu | File chính đụng tới |
| :---- | :---- | :---- |
| 1 | Nền tảng thị giác: mở rộng thang màu + bộ ba chip ngữ nghĩa, `chip.tsx`, chuẩn hóa radius/shadow, cập nhật `THUONG-HIEU.md` | `globals.css`, `components/ui/chip.tsx`, `docs/THUONG-HIEU.md` |
| 2 | Trạng thái tải/rỗng/xác nhận: `skeleton` + `loading.tsx` cho route chính, `EmptyState` có CTA, `ConfirmDialog` thay `confirm()`, `feedback.ts` | `components/ui/skeleton*.tsx`, `empty-state.tsx`, `confirm-dialog.tsx`, `feedback.ts`, các `loading.tsx` |
| 3 | Chuyển động và vi tương tác: keyframes + `prefers-reduced-motion`, `active:scale`, hover elevation, fade-in danh sách, transition thêm/xóa dòng POS | `globals.css`, `ui/button.tsx`, `ui/card.tsx`, `app-shell.tsx`, `pos-client.tsx` |
| 4 | Dashboard: `KpiCard` bấm-để-lọc + `ThanhTienDo`, cảnh báo dùng chip ngữ nghĩa, skeleton | `[store]/page.tsx`, `ui/kpi-card.tsx`, `ui/thanh-tien-do.tsx` |
| 5 | Nhất quán danh sách và bảng: chuẩn hóa `Card`, nâng `Pagination`, mở `MobileCard` cho báo cáo và các bảng còn cuộn ngang, keyboard nav cho `product-picker` | `ui/card.tsx`, `pagination.tsx`, `reports/*`, `payables/*`, `receipts/*`, `product-picker.tsx` |
| 6 | Data-viz: nâng bar chart, thêm donut/stacked cho cơ cấu doanh thu/chi phí | `daily-bars.tsx`, `components/charts/*`, `reports/page.tsx` |
| 7 | Form phức tạp: `Stepper` + `FormWizard` + `Dialog` 3 tầng; áp cho phiếu nhập mới (form trái + tổng chi phí/công nợ phải realtime), đơn online mới, chuyển kho | `ui/stepper.tsx`, `ui/form-wizard.tsx`, `ui/dialog.tsx`, `receipts/new/*`, `orders/new/*`, `transfers/new/*` |
| 8 | Rà soát: đo tương phản, target 44px, focus-ring, `sr-only`; cập nhật `THUONG-HIEU.md` + `HE-THONG.md`; xóa token/util cũ không còn gọi | `globals.css`, `docs/*` |

Thứ tự: Phase 1 và 2 chạy trước mọi phase khác. Phase 3 độc lập, chạy được sau 1. Phase 4-7 áp vào màn hình, nên sau 1-2. Phase 8 chạy cuối.

Ước lượng độ nặng: Phase 1 và 7 nặng nhất; Phase 2, 4, 5 trung bình; Phase 3, 6, 8 nhẹ.

## 6. Ràng buộc bắt buộc cho mọi phase

- Tuân thủ `CLAUDE.md`: không emoji/icon trang trí; thay đổi phẫu thuật, mỗi dòng sửa truy được về mục tiêu; ưu tiên đơn giản, không thêm tính năng ngoài yêu cầu.
- Không thêm thư viện mới. Đã đủ: Base UI, cva, lucide, sonner, react-hook-form, zod.
- Không hardcode hex ngoài `globals.css`.
- Dark mode và bản in (`@media print`) phải còn chạy đúng sau mỗi phase.
- Không đổi RPC/logic nghiệp vụ. Đợt này chỉ đụng lớp trình bày và client.
- Icon lấy từ `lucide-react`.
- Tự kiểm sau mỗi phase: `npm run typecheck && npm run lint && npm run build`. Nếu phase đụng migration (không dự kiến trong đợt này) thì thêm `npm run db:test`.
- Deploy sau mỗi phase (theo `CLAUDE.md` mục 6 và `HE-THONG.md` mục 11): `git push origin main`, Vercel tự build. Không migration nên không cần `supabase db push`.
- Mỗi phase một session mới, commit sau mỗi phase để phase sau không đọc lại diff cũ.

## 7. Phân tích thiết kế toàn diện 8 yếu tố

- UX/UI: đợt này lấp đúng ba trạng thái mà app đang thiếu (đang tải, rỗng, lỗi) và thống nhất ngôn ngữ màu trạng thái, giảm số lần người dùng phải đoán. Số bước thao tác không tăng; wizard Phase 7 gom form dài thành các bước rõ ràng.
- Tâm lý: skeleton cho cảm giác "app đang phản hồi" thay vì đứng hình; màu trạng thái giữ nguyên nghĩa ở mọi màn nên không phải học lại; nút có phản hồi bấm (scale) tạo cảm giác chắc tay khi thao tác nhanh giữa ca.
- Sinh lý: đứng quầy cả ca, thao tác nhanh một tay trên điện thoại - vi tương tác phải nhẹ, không gây chờ; tôn trọng `prefers-reduced-motion` cho người nhạy chuyển động; giữ nền trắng ngà, chữ màu mực đỡ mỏi mắt.
- Design thinking: vấn đề thật là nhân viên bấm mà không biết app có nhận không (thiếu loading) và quản lý phải quét mắt bảng xám không phân biệt trạng thái (thiếu chip). Bằng chứng: báo cáo khảo sát hiện trạng. Cách đơn giản hơn: không làm lại design system, chỉ bổ sung tầng thiếu và mượn primitive đã chín của 26c.
- Gamification: KHÔNG áp dụng. Công cụ vận hành và xử lý tiền cần nghiêm túc, chính xác; huy hiệu/điểm dễ gây sai lệch hành vi bán hàng. Giữ nguyên quan điểm của `THUONG-HIEU.md`.
- Data analytics: chưa có số liệu sử dụng thật. Sau khi chạy, đề xuất đo: thời gian điều hướng cảm nhận (trước/sau khi có skeleton), số lần bấm nhầm do không phân biệt trạng thái, tỷ lệ dùng báo cáo trên mobile (sau khi có thẻ).
- Business: không thêm chi phí vận hành; không thêm thư viện nên bundle không phình; nhận diện thống nhất trên app - hóa đơn - tem in. Giảm lỗi thao tác gián tiếp giảm sai sổ.
- Accessibility: mọi cặp nền-chữ đo tương phản >= 4.5:1 ghi trong comment; trạng thái không chỉ bằng màu; target bấm >= 44px; `focus-ring` rõ; `sr-only` cho biểu đồ và icon; `aria-pressed`/`aria-busy` cho KPI lọc và skeleton.

## 8. Cách chạy để tiết kiệm token

- Mỗi phase một session mới. Mở phase bằng cách trỏ tới đúng mục trong file này, không dán lại toàn bộ.
- Đọc code 26c theo file cụ thể ở mục 4 khi cần đối chiếu, không đọc cả cây.
- Phase 4, 5 cùng đụng nhiều trang danh sách: commit sau mỗi phase để phase sau không đọc diff cũ.
- Nếu một session dài ra vì phát sinh, dừng lại ghi phần còn thiếu vào cuối file này rồi mở session mới.
