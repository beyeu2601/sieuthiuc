# Kế hoạch nâng cấp UX/UI - phần tiếp (Phase 3 đến 8)

File này nối tiếp `docs/KE-HOACH-UI.md` (kế hoạch gốc 8 phase). Phase 1 và 2 đã xong và deploy. File này gom phần còn lại (Phase 3-8) thành checklist thi hành cho từng session mới, kèm prompt mở đầu để gọi từ tài khoản Claude khác. Đọc `docs/HE-THONG.md`, `docs/THUONG-HIEU.md` và mục tương ứng trong `docs/KE-HOACH-UI.md` trước khi làm.

## Table of Contents

- [1. Trạng thái hiện tại](#1-trạng-thái-hiện-tại)
- [2. Ràng buộc bắt buộc mọi phase](#2-ràng-buộc-bắt-buộc-mọi-phase)
- [3. Tài sản đã có sau Phase 1-2](#3-tài-sản-đã-có-sau-phase-1-2)
- [4. Phase 3 - Chuyển động và vi tương tác](#4-phase-3---chuyển-động-và-vi-tương-tác)
- [5. Phase 4 - Dashboard](#5-phase-4---dashboard)
- [6. Phase 5 - Nhất quán danh sách và bảng](#6-phase-5---nhất-quán-danh-sách-và-bảng)
- [7. Phase 6 - Data-viz](#7-phase-6---data-viz)
- [8. Phase 7 - Form phức tạp](#8-phase-7---form-phức-tạp)
- [9. Phase 8 - Rà soát và dọn dẹp](#9-phase-8---rà-soát-và-dọn-dẹp)
- [10. Prompt mở từng phase](#10-prompt-mở-từng-phase)

## 1. Trạng thái hiện tại

Tính đến 29/09/2026:

- Phase 1 xong (commit `2b21d5d`): mở rộng thang màu ngữ nghĩa + bộ ba chip trong `globals.css`, tạo `src/components/ui/chip.tsx`, cập nhật `docs/THUONG-HIEU.md`.
- Phase 2 xong (commit `c14b240`): `skeleton.tsx` + `skeleton-trang.tsx` + 10 file `loading.tsx`, `empty-state.tsx` thêm `icon`/`action`, `confirm-dialog.tsx` (`ConfirmDialog` + hook `useConfirm`), `feedback.ts`, thay 8 chỗ `confirm()` gốc trình duyệt.
- Cả hai đã deploy lên prod (Vercel tự build từ `main`).
- Phase 3 xong: dùng tiện ích `tw-animate-css` bọc `motion-safe:` (không tự viết keyframes); khối `prefers-reduced-motion: reduce` toàn cục lấy từ 26c trong `globals.css`; nút nhấn `scale-[0.98]`; nội dung trang mờ dần khi đổi màn (`app-shell.tsx`, key theo pathname); dòng `TableRow`, `MobileCard` và dòng giỏ POS mờ dần khi xuất hiện. `Card` chưa được trang nào dùng và chưa có biến thể bấm được nên giữ nguyên. Xóa dòng giỏ POS không có hiệu ứng rời đi (cần trì hoãn cập nhật state, để tránh đụng logic giỏ).
- Phase 4 xong: `kpi-card.tsx` (`KpiCard` + `HangKpi`) và `thanh-tien-do.tsx` (`ThanhTienDo`, tô bằng token `bg-chu-*`). KpiCard ở đây là Link sang màn chi tiết, bỏ bấm-để-lọc/`aria-pressed` (dashboard không có danh sách để lọc), bỏ biến động % (pnl_report không trả số kỳ trước, thêm truy vấn là đổi dữ liệu) và `dangTai` (đã có `loading.tsx`). Lãi gộp tô emerald/red theo dấu; "Mã còn tồn" kèm thanh x/y so với số mã đang bán. Cảnh báo dùng chip ngữ nghĩa. Chưa có cảnh báo "ca cần kiểm tra" vì dashboard chưa truy vấn ca cần kiểm tra - thêm là thêm truy vấn, cần chủ dự án đồng ý. `[store]/loading.tsx` vẽ đúng khung dashboard.
- Phase 5 xong một phần: `pagination.tsx` thêm nút trang đầu/cuối (chưa có đổi pageSize vì mỗi trang cố định `PAGE_SIZE` ở server); thẻ mobile cho `reports/page.tsx` (bảng lãi lỗ thành danh sách dòng, bảng theo ngày thành `MobileCard`), `reports/best-sellers`, `payables` (3 tab), `receipts` và `receipts/[id]`; `product-picker.tsx` có phím lên/xuống, Enter chọn dòng đang sáng, Esc đóng, kèm `role="combobox"` + `aria-activedescendant`. Chưa có dòng nào sáng thì Enter giữ hành vi cũ nên máy quét không đổi. Mục 2 (thống nhất `Card`) CHƯA làm, chờ chủ dự án quyết: có 90 chỗ `rounded-xl border bg-card` (chuẩn thực tế), `Card` của shadcn không ai dùng và vẽ viền bằng `ring`; đổi hàng loạt sẽ đổi hình viền.
- Phase 6 xong: `daily-bars.tsx` tách nhãn trục ra HTML (trước đây chữ nằm trong SVG nên trên điện thoại chỉ còn khoảng 5px), thêm trục giá trị rút gọn (`850 N`, `12,5 Tr`) và đường mốc cao nhất, nhãn trình đọc màn hình có tóm tắt ngày cao nhất. Tạo `src/components/charts/thanh-co-cau.tsx` (`ThanhCoCau`, thanh cơ cấu 100%): chọn thanh ngang thay donut vì đọc được trên màn hẹp. Kênh bán tô bằng `sacKenhBan`, loại hàng bằng `sacLoaiHang`, phương thức và nhóm chi phí lấy màu theo thứ tự cố định (`sacTheoThuTu`). Thanh là hình minh họa (`aria-hidden`); chú giải là danh sách chữ đủ nhãn, số tiền, %, nên không thêm bảng `sr-only` trùng lặp. Bảng số liệu theo ngày (`details`) vẫn giữ.
- Phase 7 xong: `dialog.tsx` thành 3 tầng (`DialogContent` giới hạn chiều cao màn hình, `DialogHeader`/`DialogFooter` không co, `DialogBody` mới là vùng cuộn; hộp thoại chưa dùng `DialogBody` thì cả hộp cuộn thay vì tràn khỏi màn). Port `stepper.tsx` + `form-wizard.tsx` (mount-all); khác 26c: bấm được mọi bước khi các bước trước đã hợp lệ, `nutPhu` hiện mọi bước, có dòng lý do khi chưa đi tiếp được, đổi bước thì focus ô nhập đầu tiên. Phiếu nhập (mới và sửa nháp) chia 4 bước Nhà cung cấp -> Hàng nhập -> Chi phí -> Kiểm tra, "Lưu nháp" có ở mọi bước, cột phải (máy tính) tóm tắt tổng và công nợ dự kiến theo số ngày nợ của NCC; thanh toán vẫn ở hộp thoại Xác nhận nhập kho (RPC xác nhận cần phiếu đã lưu), hộp thoại này và hai hộp tạo nhanh NCC/sản phẩm dùng 3 tầng. Đơn online và chuyển kho ngắn nên không làm wizard, chỉ cho thanh tổng/nút dính đáy. Sửa lỗi cũ: thanh dính đáy của phiếu nhập bị thanh tab dưới đáy điện thoại che - nay trừ 4rem trên điện thoại.
- Phase 8 xong: đo lại tương phản từ mã màu (mọi cặp chip, chữ sắc trên thẻ, thanh tiến độ, chữ phụ đều đạt ở bản sáng/tối/in, bảng số ở `docs/THUONG-HIEU.md` mục 2). Nâng vùng chạm nút phân trang và nút wizard lên 44px, chữ trục biểu đồ lên 12px. Không xóa export nào: các helper chưa ai gọi (`ChipTrangThaiCa`, `ChipTrangThaiPhieu`, `sacTonKho`, `sacHan`, `sacTheoNhan`, `baoThanhCong`, `baoCanhBao`, `baoLoi`) là bảng ánh xạ đã chốt trong tài liệu, chưa được áp chứ không bị làm thừa - ghi vào việc còn lại. Ngày 08/10/2026 đã xóa `ChipTrangThaiCa`, `ChipTrangThaiPhieu`, `sacTonKho`, `sacHan` vì quy ước đã chốt là `ChipSac` + sắc trong `labels.ts` (cùng màu); `sacTheoNhan` đã được trang chi tiết sản phẩm dùng. Cập nhật `docs/THUONG-HIEU.md` (tương phản, vùng chạm, chuyển động, biểu đồ, việc còn lại) và `docs/HE-THONG.md` mục 6 (bảng thành phần dùng chung, luồng phiếu nhập).
- Còn lại: Phase 5 mục 2 (thống nhất `Card`, chờ quyết). Việc tiếp theo ngoài kế hoạch này ghi ở `docs/THUONG-HIEU.md` mục 8.

Thứ tự chạy: 3 chạy được ngay (độc lập). 4, 5 sau đó (áp vào màn hình). 6 sau 5. 7 nặng nhất, sau 5. 8 chạy cuối cùng.

Mỗi phase một session mới, commit + deploy sau mỗi phase để phase sau không phải đọc lại diff cũ.

## 2. Ràng buộc bắt buộc mọi phase

Giữ nguyên như mục 6 của `docs/KE-HOACH-UI.md`. Tóm tắt để không phải mở lại:

- Tuân thủ `CLAUDE.md`: không emoji/icon trang trí trong code, doc, commit; thay đổi phẫu thuật, mỗi dòng sửa truy được về mục tiêu; đơn giản trước, không thêm tính năng ngoài yêu cầu.
- Không thêm thư viện mới. Đã đủ: Base UI (`@base-ui/react`), cva, lucide-react, sonner, react-hook-form, zod, @tanstack/react-query.
- Không hardcode mã hex ngoài `src/app/globals.css`. Chỉ gọi tên token/chip đã khai ở Phase 1.
- Dark mode và bản in (`@media print`) phải còn chạy đúng sau mỗi phase.
- Không đổi RPC / logic nghiệp vụ. Đợt này chỉ đụng lớp trình bày và client.
- Icon lấy từ `lucide-react`.
- Ký tự Unicode kiểu AI thay bằng ASCII: gạch dài thành `-`, mũi tên thành `->`, ba chấm thành `...`.
- Tự kiểm sau mỗi phase: `npm run typecheck && npm run lint && npm run build`, cả ba phải exit 0.
- Commit sau mỗi phase, message tiếng Việt không dấu kiểu `UI Phase N: <mô tả>`, kết thúc bằng dòng `Co-Authored-By` theo cấu hình phiên.
- Deploy: `git push origin main`. Không migration nên không cần `supabase db push`.
- Không commit thay đổi `.gitignore` hay file WIP không thuộc phase đang làm.

## 3. Tài sản đã có sau Phase 1-2

Trước khi tạo mới, kiểm tra đã có chưa để không trùng:

- Chip ngữ nghĩa: `src/components/ui/chip.tsx`. Export `SacNguNghia`, `ChipSac`, và helper theo miền: `ChipTrangThaiDon`, `ChipTonKho`, `ChipHan`, `sacKenhBan`, `sacLoaiHang`, `sacTheoNhan`. Dùng lại, đừng tô màu thủ công.
- Token màu: 9 sắc (brand/emerald/amber/rose/red/indigo/sky/purple/slate) đủ bộ ba `nen`/`chu`/`vien`, có bản dark + print, khai trong `src/app/globals.css`. Alias Tailwind: `bg-nen-<sac>`, `text-chu-<sac>`, `border-vien-<sac>`, chấm `bg-brand-500`.
- Skeleton: `src/components/ui/skeleton.tsx` (`Skeleton`), `src/components/ui/skeleton-trang.tsx` (`SkeletonTrang({ soThe })`).
- Xác nhận: `src/components/ui/confirm-dialog.tsx`. Dùng hook `useConfirm()` trả `{ confirm, dialog }`, `confirm(opts): Promise<boolean>`, nhớ render `{dialog}` trong JSX.
- Toast: `src/lib/feedback.ts`. `baoThanhCong`, `baoCanhBao`, `baoLoi(err)`, `baoTheoKetQua(res, thanhCong)`.
- Rỗng: `src/components/empty-state.tsx` nhận `icon?` (mặc định Inbox) và `action?` (CTA).
- `cn` import từ path alias `"cn"` (re-export ở `src/lib/utils.ts`).
- Dự án dùng Tailwind 4 cấu hình bằng CSS trong `globals.css`, KHÔNG có `tailwind.config.js`. Token theo pattern `@theme inline { --color-x: var(--x) }` + `:root { --x: hex }` + `.dark { --x: hex }`.

Lưu ý cho Phase 5: commit trước đó của chủ dự án đã nâng `pagination.tsx` và `filter-chip.tsx` (lọc tồn kho dạng chip tick). Xây tiếp trên đó, không làm lại từ đầu. Kiểm `git log --oneline` và đọc file hiện tại trước.

## 4. Phase 3 - Chuyển động và vi tương tác

Mục tiêu: thêm chuyển động nhẹ ở tầng trang và vi tương tác nút, tôn trọng `prefers-reduced-motion`. Không đổi hành vi nghiệp vụ.

File chính: `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/app-shell.tsx`, `src/app/(app)/[store]/pos/pos-client.tsx`.

Việc cụ thể:

1. Trong `globals.css`: định nghĩa vài keyframes tối thiểu (fade-in, fade-in-up nhẹ) và bọc TẤT CẢ trong `@media (prefers-reduced-motion: no-preference)`. Với người chọn giảm chuyển động, không animation. Kiểm `tw-animate-css` đã import chưa (mục 2.40 khảo sát: đã import nhưng gần như không dùng) - ưu tiên tiện ích có sẵn trước khi tự viết keyframes.
2. `button.tsx`: thêm `active:scale-[0.98]` (hoặc mức tương đương đang dùng ở 26c `src/components/ui/button.tsx`) và transition mượt; giữ nguyên variant, size, cva hiện có. Không đổi API.
3. `card.tsx`: hover elevation nhẹ cho card bấm được (nếu có prop/biến thể clickable); card tĩnh giữ nguyên.
4. Danh sách: fade-in khi đổi trang/khi item mới xuất hiện. Nhẹ, không gây giật.
5. POS `pos-client.tsx`: transition khi thêm/xóa dòng giỏ hàng cho cảm giác chắc tay. Không đụng logic tính tiền.

Đối chiếu 26c: đọc `c:\YEN\Source code\26c\src\app\globals.css` (phần keyframes/motion) và `button.tsx`, `card.tsx` để mượn đúng thông số, không tự chế.

Verify: `typecheck && lint && build` exit 0. Kiểm mắt: bật "reduce motion" ở OS thì không còn animation. Commit `UI Phase 3: chuyen dong va vi tuong tac`, push.

## 5. Phase 5 - Dashboard (đánh số theo kế hoạch gốc là Phase 4)

Ghi chú: kế hoạch gốc đánh Dashboard là Phase 4. Giữ tên "Phase 4" khi commit để khớp lịch sử. Mục này mô tả Phase 4.

Mục tiêu: dashboard `[store]/page.tsx` dùng `KpiCard` bấm-để-lọc + `ThanhTienDo`, cảnh báo dùng chip ngữ nghĩa, có skeleton dạng thẻ đúng hình (thay skeleton bảng chung tạm thời).

File chính: `src/app/(app)/[store]/page.tsx`, tạo mới `src/components/ui/kpi-card.tsx`, `src/components/ui/thanh-tien-do.tsx`, cập nhật `src/app/(app)/[store]/loading.tsx`.

Việc cụ thể:

1. Port `kpi-card.tsx` từ `c:\YEN\Source code\26c\src\components\ui\kpi-card.tsx`: `KpiCard` + `HangKpi`, sắc ngữ nghĩa (dùng chip Phase 1), bấm-để-lọc với `aria-pressed` + ring khi chọn, biến động %, skeleton. Bỏ phần nào 26c có mà dashboard SieuthiUc chưa cần (đơn giản trước).
2. Port `thanh-tien-do.tsx`: progress bar x/y bằng token màu, dùng cho mức tồn / tiến độ. Kèm `aria` phù hợp.
3. `[store]/page.tsx`: thay các ô số hiện tại bằng `KpiCard`; cảnh báo (tồn thấp, cận date, ca cần kiểm tra) render bằng `ChipTonKho`/`ChipHan`/`ChipTrangThaiCa`. Không đổi truy vấn dữ liệu / RPC.
4. `[store]/loading.tsx`: đổi sang skeleton thẻ KPI đúng bố cục dashboard (hiện đang dùng `SkeletonTrang soThe={4}` chung).

Verify + commit `UI Phase 4: dashboard KpiCard va ThanhTienDo`, push.

## 6. Phase 5 - Nhất quán danh sách và bảng

Mục tiêu: chuẩn hóa dùng `Card`, nâng phần còn thiếu của `Pagination`, mở `MobileCard` cho các bảng còn cuộn ngang (nhất là báo cáo), thêm điều hướng bàn phím cho `product-picker`.

File chính: `src/components/ui/card.tsx`, `src/components/ui/pagination.tsx`, `src/app/(app)/[store]/reports/*`, `[store]/payables/*`, `[store]/receipts/*`, `src/components/product-picker.tsx`.

Việc cụ thể:

1. Kiểm `pagination.tsx` hiện tại (đã được nâng ở commit trước): còn thiếu số trang / đổi pageSize / nút đầu-cuối thì bổ sung; nếu đã đủ thì bỏ qua, chỉ áp vào chỗ chưa dùng.
2. Rà các trang lặp `rounded-xl border bg-card p-4` và bo góc không nhất quán (chỗ `rounded-xl`, chỗ `rounded-2xl`) -> thống nhất qua `Card`. Thay dần, không refactor ồ ạt ngoài phạm vi.
3. Báo cáo `reports/*` trên mobile đang cuộn ngang: thêm biến thể `MobileCard` (`src/components/mobile-card.tsx` đã có pattern) cho các bảng chính. Bảng giữ ở `md:block`, thẻ ở `md:hidden`.
4. `payables/*`, `receipts/*`: các bảng còn cuộn ngang -> mở `MobileCard` tương tự.
5. `product-picker.tsx`: thêm điều hướng bàn phím (arrow up/down, Enter chọn, Esc đóng) như `command-palette.tsx`. Giữ tìm không dấu hiện có.

Verify + commit `UI Phase 5: nhat quan danh sach va bang`, push.

## 7. Phase 6 - Data-viz

Mục tiêu: nâng biểu đồ cột tự viết, thêm donut/stacked cho cơ cấu doanh thu/chi phí (đang là danh sách phần trăm dạng chữ). Không thêm thư viện chart - tự dựng bằng SVG/CSS + token.

File chính: `src/components/daily-bars.tsx`, tạo `src/components/charts/*`, `src/app/(app)/[store]/reports/page.tsx`.

Việc cụ thể:

1. Đối chiếu `c:\YEN\Source code\26c\src\components\charts\bar-chart.tsx` để mượn cấu trúc SVG + token + `<table class="sr-only">` cho a11y.
2. Nâng `daily-bars.tsx` (hoặc thay bằng chart chung) dùng token màu, có nhãn trục, tooltip nhẹ.
3. Thêm donut hoặc stacked bar cho cơ cấu doanh thu theo kênh / cơ cấu chi phí. Mỗi lát tô bằng sắc ngữ nghĩa (`sacKenhBan`, ...). Kèm bảng `sr-only` liệt kê số liệu.
4. `reports/page.tsx`: thay danh sách phần trăm chữ bằng biểu đồ mới; giữ số liệu gốc, không đổi truy vấn.

Verify + commit `UI Phase 6: data-viz bar donut stacked`, push.

## 8. Phase 7 - Form phức tạp

Phase nặng nhất. Mục tiêu: `Stepper` + `FormWizard` (mount-all) + `Dialog` 3 tầng (header đứng yên, body cuộn, footer luôn thấy). Áp cho phiếu nhập mới, đơn online mới, chuyển kho. Được phép đổi luồng NHẬP cho gọn nhưng KHÔNG đổi RPC.

File chính: tạo `src/components/ui/stepper.tsx`, `src/components/ui/form-wizard.tsx`, nâng `src/components/ui/dialog.tsx`; `receipts/new/*`, `orders/new/*`, `transfers/new/*`.

Việc cụ thể:

1. Nâng `dialog.tsx` thành 3 tầng: header + footer không cuộn, body cuộn - form dài không đẩy nút Lưu khỏi màn. Giữ API cũ tương thích các chỗ đang dùng.
2. Port `stepper.tsx` + `form-wizard.tsx` từ 26c (mount-all: mọi bước render sẵn, chỉ ẩn/hiện, để state không mất khi qua lại). Đọc `c:\YEN\Source code\26c\src\components\ui\stepper.tsx` và `form-wizard.tsx`.
3. Phiếu nhập mới `receipts/new/*`: form bên trái, tổng chi phí / công nợ cập nhật realtime bên phải. Chia bước hợp lý (chọn NCC -> nhập dòng hàng -> chi phí/thanh toán -> xác nhận). Không đổi RPC tạo phiếu.
4. Đơn online mới `orders/new/*` và chuyển kho `transfers/new/*`: áp wizard tương tự nếu form đủ dài; nếu ngắn thì chỉ áp dialog 3 tầng.

Đây là phase dễ tràn context nhất. Nếu một session không xong, chia nhỏ: session A làm primitive (`dialog` 3 tầng + `stepper` + `form-wizard` + verify), session B áp vào `receipts/new`, session C áp `orders/new` + `transfers/new`. Commit sau mỗi phần.

Verify + commit `UI Phase 7: stepper form-wizard dialog 3 tang`, push.

## 9. Phase 8 - Rà soát và dọn dẹp

Mục tiêu: chốt a11y, dọn token/util không còn dùng, cập nhật tài liệu.

File chính: `src/app/globals.css`, `docs/THUONG-HIEU.md`, `docs/HE-THONG.md`.

Việc cụ thể:

1. Đo lại tương phản các cặp nền-chữ chip (>= 4.5:1), sửa cặp nào chưa đạt. Kiểm target bấm >= 44px, focus-ring rõ, `sr-only` cho biểu đồ và icon-only, `aria-pressed`/`aria-busy` đúng chỗ.
2. Xóa token màu / util cũ không còn ai gọi (chỉ xóa cái do đợt này làm thừa; không đụng dead code có sẵn từ trước trừ khi được yêu cầu). Dùng grep để chắc chắn không còn tham chiếu trước khi xóa.
3. Cập nhật `docs/THUONG-HIEU.md` và `docs/HE-THONG.md`: ghi lại hệ chip ngữ nghĩa, primitive mới, quy ước dùng. Giữ Table of Contents.
4. Kiểm dark mode + `@media print` toàn app lần cuối.

Verify + commit `UI Phase 8: ra soat a11y va don dep`, push.

## 10. Prompt mở từng phase

Dán một trong các prompt sau khi mở session mới ở tài khoản Claude khác (giữ nguyên thư mục dự án). Mỗi prompt tự trỏ tới đúng mục trong file này để tiết kiệm token.

Phase 3:

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 4, đọc docs/HE-THONG.md, rồi thi hành Phase 3 (chuyển động và vi tương tác). Đối chiếu code motion của 26c ở c:\YEN\Source code\26c khi cần. Chạy typecheck + lint + build, commit và push khi xong. Tuân thủ CLAUDE.md: không emoji/icon, không hardcode hex ngoài globals.css, không thêm thư viện, không đổi RPC, thay đổi phẫu thuật.
```

Phase 4 (Dashboard):

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 5, đọc docs/HE-THONG.md, rồi thi hành Phase 4 (Dashboard: KpiCard + ThanhTienDo). Port primitive từ 26c ở c:\YEN\Source code\26c\src\components\ui. Chạy typecheck + lint + build, commit và push khi xong. Tuân thủ CLAUDE.md và các ràng buộc ở mục 2.
```

Phase 5 (Danh sách và bảng):

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 6, đọc docs/HE-THONG.md, rồi thi hành Phase 5 (nhất quán danh sách và bảng). Lưu ý pagination và filter-chip đã được nâng ở commit trước, xây tiếp trên đó, đọc file hiện tại trước. Chạy typecheck + lint + build, commit và push khi xong. Tuân thủ CLAUDE.md và mục 2.
```

Phase 6 (Data-viz):

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 7, đọc docs/HE-THONG.md, rồi thi hành Phase 6 (data-viz). Không thêm thư viện chart, tự dựng SVG/CSS + token, đối chiếu c:\YEN\Source code\26c\src\components\charts. Chạy typecheck + lint + build, commit và push khi xong. Tuân thủ CLAUDE.md và mục 2.
```

Phase 7 (Form phức tạp):

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 8, đọc docs/HE-THONG.md, rồi thi hành Phase 7 (Stepper + FormWizard + Dialog 3 tầng, áp cho phiếu nhập/đơn online/chuyển kho mới). Được đổi luồng nhập cho gọn nhưng KHÔNG đổi RPC. Nếu context sắp tràn thì chia nhỏ theo hướng dẫn trong mục 8, commit từng phần. Chạy typecheck + lint + build, commit và push. Tuân thủ CLAUDE.md và mục 2.
```

Phase 8 (Rà soát):

```
Đọc docs/KE-HOACH-UI-TIEP.md mục 2, 3 và 9, đọc docs/HE-THONG.md, rồi thi hành Phase 8 (rà soát a11y, dọn token/util thừa do đợt này tạo, cập nhật THUONG-HIEU.md và HE-THONG.md). Chỉ xóa dead code do đợt này làm thừa, grep kiểm tham chiếu trước khi xóa. Chạy typecheck + lint + build, commit và push. Tuân thủ CLAUDE.md và mục 2.
```
