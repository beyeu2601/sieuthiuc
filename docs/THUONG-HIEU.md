# Bộ nhận diện và nguyên tắc giao diện Siêu Thị Úc

Tài liệu cho người phát triển và người thiết kế. Mọi màu, chữ, kích thước trong app lấy từ đây; đổi ở `src/app/globals.css` thay vì ghi cứng trong trang.

## Table of Contents

- [1. Phân tích logo](#1-phân-tích-logo)
- [2. Màu](#2-màu)
  - [Màu ngữ nghĩa trạng thái](#màu-ngữ-nghĩa-trạng-thái)
- [3. Chữ](#3-chữ)
- [4. Tệp logo và icon](#4-tệp-logo-và-icon)
- [5. Bố cục và điều hướng](#5-bố-cục-và-điều-hướng)
- [6. Kích thước và vùng chạm](#6-kích-thước-và-vùng-chạm)
  - [Chế độ tối](#chế-độ-tối)
  - [Chuyển động](#chuyển-động)
  - [Biểu đồ](#biểu-đồ)
- [7. Nguyên tắc tâm lý và sinh lý người dùng](#7-nguyên-tắc-tâm-lý-và-sinh-lý-người-dùng)
- [8. Việc còn lại](#8-việc-còn-lại)

## 1. Phân tích logo

Tệp gốc: `logo.jpg` (2048 x 2048). Logo là hình con kangaroo đẩy xe mua hàng, chữ "SIÊU THỊ ÚC" xếp ba dòng nằm trong lòng xe, đặt trên ảnh nền Nhà hát Opera Sydney làm mờ.

- Biểu tượng: kangaroo nói ngay "hàng Úc", xe đẩy nói "siêu thị". Nét tròn, mặt cười, dáng thân thiện, không cứng nhắc.
- Một màu duy nhất: xanh `#324CA0`. Chi tiết mắt, mũi, miệng màu mực `#1B2340`.
- Chữ: sans-serif đậm, hẹp ngang (condensed), chữ in hoa.
- Ảnh nền Sydney là trang trí, không thuộc logo. App dùng bản đã tách nền (mục 4).

## 2. Màu

| Token | Giá trị | Dùng cho | Tương phản |
|---|---|---|---|
| `--brand` / `--primary` | `#324CA0` | Nút chính, mục đang chọn, liên kết | 7,8:1 trên trắng |
| `--brand-strong` | `#263C82` | Rê chuột trên nút chính | 10,2:1 với chữ trắng |
| `--brand-soft` | `#EEF2FB` | Nền nhẹ khi rê chuột, ô chọn cửa hàng | chữ xanh 7,0:1 |
| `--foreground` | `#1B2340` | Chữ thường (màu mực của logo, không dùng đen tuyền) | 14,4:1 trên nền |
| `--muted-foreground` | `#586178` | Chữ phụ, nhãn | 5,8:1 trên nền |
| `--background` | `#F5F7FB` | Nền trang | |
| `--card` | `#FFFFFF` | Khối nội dung, bảng, ô nhập | |
| `--border` / `--input` | `#DDE2EE` / `#C9D1E3` | Viền khối / viền ô nhập | |
| `--success` + `--success-soft` | `#1E7A4C` / `#E8F5EE` | Tốt, đã xong, lãi | 4,8:1 |
| `--warning` + `--warning-soft` | `#8A5300` / `#FDF3E1` | Cần chú ý | 5,8:1 |
| `--destructive` + `--danger-soft` | `#B42318` / `#FDECEA` | Lỗi, lỗ, hủy | 5,8:1 |

Quy tắc:

- Một màu HÀNH ĐỘNG, nhiều màu NGỮ NGHĨA. Xanh thương hiệu là màu hành động duy nhất: nút chính, liên kết, mục đang chọn, vòng focus. Ngoài ra có một bảng màu ngữ nghĩa cho trạng thái, kênh bán và loại hàng (xem mục dưới). Màu không dùng để trang trí; màu chính là ngữ nghĩa.
- Trạng thái luôn đi kèm chữ hoặc biểu tượng, không chỉ dựa vào màu (người mù màu vẫn đọc được).
- Mọi cặp chữ và nền đạt WCAG AA (từ 4,5:1).
- Không ghi cứng mã hex ngoài `src/app/globals.css`.

### Màu ngữ nghĩa trạng thái

Học từ dự án 26c Academy (xem `docs/KE-HOACH-UI.md`). Kiến trúc ba lớp trong `globals.css`: thang thô -> bộ ba chip `nen`/`chu`/`vien` cho từng sắc -> token nền trang. Bộ ba chip là lớp duy nhất có bản tối riêng và bản in riêng, nên component gọi chip không phải viết `dark:`. Dùng qua `src/components/ui/chip.tsx` (`ChipSac` và các helper theo miền), không tự chọn mã màu ở trang.

Chín sắc và nghĩa cố định:

| Sắc | Dùng cho |
|---|---|
| `brand` (xanh logo) | Ca đã duyệt; kênh bán tại quầy (POS). Đồng thời là màu hành động. |
| `emerald` | Đang mở, đã xong, đã xác nhận, giao thành công, đã trả, lãi/số dương |
| `amber` | Chờ một bước nữa: chờ duyệt, chờ xác nhận, tồn thấp, cận date; kênh Shopee |
| `rose` | Cảnh báo nhẹ (nhắc nhở), tách khỏi đỏ tiền. KHÔNG phải màu nợ. |
| `red` | Tiền/lỗ/số âm, hết hạn, hết hàng, hủy, quá hạn |
| `indigo` | Đơn giữ hàng; loại hàng Cont |
| `sky` | Đang giao; kênh Facebook; loại hàng Air |
| `purple` | Phân loại phụ (dành cho nhóm chưa có nghĩa cố định) |
| `slate` | Trung tính: nháp, đủ tồn, còn hạn, kênh khác |

`rose` và `red` là hai thang khác nhau, cố ý không gộp. Nhãn tự do (nhóm hàng, tên nhà cung cấp) dùng `sacTheoNhan` để một tên luôn ra một sắc ổn định. Bảng ánh xạ đầy đủ nghĩa -> sắc ở `docs/KE-HOACH-UI.md` mục 3.

Tương phản đo lại ngày 30/09/2026 từ mã màu trong `globals.css` (bản sáng / tối / in):

| Cặp | Thấp nhất | Ngưỡng |
|---|---|---|
| Chữ chip trên nền chip, 9 sắc | 6,37 (amber) / 9,21 (indigo) / 6,37 | 4,5 |
| Chữ sắc trên nền thẻ (nhãn thẻ chỉ số) | 7,09 / 10,83 / 7,09 | 4,5 |
| Phần đã chạy của thanh tiến độ (`bg-chu-*`) trên `muted` | 6,27 / 9,49 / 6,27 | 3 (hình khối) |
| Chữ phụ trên nền thẻ, nền trang, nền `muted` | 5,47 / 6,45 / 5,47 | 4,5 |

Chấm màu (`CHAM_SAC`, bậc 500) và các lát của thanh cơ cấu là hình minh họa, luôn đi kèm chữ nên không áp ngưỡng chữ.

## 3. Chữ

| Vai trò | Font | Ghi chú |
|---|---|---|
| Nội dung | Be Vietnam Pro 400/500/600/700 | Thiết kế cho dấu tiếng Việt, dấu không dính vào chữ ở cỡ nhỏ |
| Tiêu đề trang, tên thương hiệu | Barlow Condensed 600/700 | Hẹp ngang và đậm như chữ trong logo; lớp `font-heading` |
| Số tiền, số lượng | Be Vietnam Pro, `tabular-nums` | Chữ số cùng độ rộng để cột số thẳng hàng |

- Không dùng Barlow Condensed cho số tiền. Chữ hẹp dễ đọc nhầm số khi đếm tiền.
- `formatMoney` nối số và `₫` bằng dấu cách không ngắt dòng, nên số tiền không bao giờ bị tách thành hai dòng.

## 4. Tệp logo và icon

Sinh lại bằng `python scripts/brand-assets.py` (cần Pillow, numpy, scipy). Script tách màu xanh khỏi nền, giữ mắt mũi miệng, bỏ chữ để làm bản chỉ có hình.

| Tệp | Dùng ở đâu |
|---|---|
| `public/brand/logo.png` | Bản đầy đủ nền trong suốt: trang đăng nhập trên điện thoại |
| `public/brand/logo-light.png`, `logo-mark-light.png` | Bản xanh nhạt cho chế độ tối (logo xanh gốc trên nền tối chỉ đạt 2,5:1) |
| `public/brand/logo-print.png` | Bản đen thuần 1 bit cho hóa đơn in nhiệt (máy in nhiệt không in được nửa tông) |
| `public/brand/logo-white.png` | Bản trắng trên nền xanh: mảng thương hiệu trang đăng nhập |
| `public/brand/logo-mark.png` | Chỉ hình kangaroo và xe: thanh bên, thanh trên điện thoại |
| `public/brand/logo-mark-white.png` | Chỉ hình, màu trắng (dự phòng) |
| `public/icons/icon-192.png`, `icon-512.png` | Icon PWA khi cài lên điện thoại |
| `public/icons/icon-512-maskable.png` | Icon PWA Android, nội dung trong vùng an toàn 68% |
| `src/app/apple-icon.png`, `src/app/favicon.ico` | iPhone và tab trình duyệt (favicon chỉ dùng hình vì chữ không đọc được ở 16px) |

Không kéo giãn, không đổi màu logo ngoài hai bản xanh và trắng, chừa khoảng trống quanh logo tối thiểu bằng chiều rộng bánh xe đẩy.

## 5. Bố cục và điều hướng

- Máy tính (từ 1024px): thanh bên trái 252px gồm logo, cửa hàng, điều hướng chia nhóm (Bán hàng, Kho, Tài chính, Danh mục, Hệ thống), tài khoản ở cuối. Cấu hình ở `src/lib/nav.ts`, giao diện ở `src/components/app-shell.tsx`.
- Điện thoại: thanh trên gọn (logo, tên cửa hàng, tài khoản) và thanh tab dưới đáy gồm 4 việc hay làm nhất theo vai trò cộng nút "Thêm" mở bảng trượt chứa mọi chức năng (`MOBILE_TABS`).
- Trang Tổng quan: một hành động chính nổi bật (Bán hàng), ba việc phụ dạng ô lớn, chỉ số, rồi danh sách cảnh báo.

## 6. Kích thước và vùng chạm

| Thành phần | Chiều cao |
|---|---|
| Nút mặc định, ô nhập, ô chọn | 40px |
| Nút `lg`, ô đăng nhập | 44-48px |
| Mục điều hướng thanh bên | 40px |
| Tab dưới đáy điện thoại | 64px, cộng vùng an toàn của máy |
| Nút thanh toán POS | 56px |
| Nút phân trang, nút điều hướng wizard (Quay lại, Tiếp tục, Lưu nháp) | 44px |
| Bước trên thanh tiến trình wizard | 44px |
| Thẻ chỉ số dashboard, dòng cảnh báo | 56px / 48px |

Ô tên sản phẩm trong bảng được xuống dòng để các cột giá, tồn luôn nằm trong màn hình. Trên điện thoại (dưới 768px), bảng nhiều cột chuyển thành thẻ: tên và trạng thái ở trên, số liệu có nhãn ở dưới (`src/components/mobile-card.tsx`). Đã áp cho Tồn kho, Nhập xuất tồn, Sản phẩm, Giá vốn, Lãi lỗ, Bán chạy, Công nợ, Phiếu nhập.

Thanh dính đáy (tổng tiền, nút lưu) trên điện thoại đặt cách đáy bằng chiều cao tab dưới đáy (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`, về `bottom-0` từ `lg`), nếu không sẽ bị tab che.

### Chế độ tối

- Mặc định theo cài đặt của máy; người dùng chọn Sáng, Tối hoặc Theo máy trong menu tài khoản. Lựa chọn lưu ở trình duyệt (`localStorage`), áp dụng trước khi vẽ trang nên không nháy màu (`src/components/theme.tsx`).
- Cùng hệ màu, chọn lại bước sáng tối chứ không đảo tự động. Trên nền tối `--brand` (chữ, biểu tượng) là `#9DB0F0`, tách khỏi `--primary` (nền nút) là `#3A56B4`.
- Tương phản trên nền tối: chữ 13,9-15,2:1, chữ phụ 7,4:1, nút xanh chữ trắng 6,6:1, màu trạng thái từ 7:1.
- Dùng khi làm việc buổi tối hoặc chỗ thiếu sáng; tại quầy sáng đèn nên giữ chế độ sáng.

### Chuyển động

- Chỉ chuyển động ngắn (150-200ms) để xác nhận thao tác: nội dung mờ dần khi đổi màn, dòng bảng/thẻ/dòng giỏ POS mới xuất hiện mờ dần, nút co nhẹ `scale-[0.98]` khi nhấn. Không có chuyển động trang trí.
- Dùng tiện ích của `tw-animate-css` bọc trong `motion-safe:`, không tự viết keyframes.
- Người bật "giảm chuyển động" ở hệ điều hành: khối `prefers-reduced-motion: reduce` cuối `globals.css` đưa mọi animation/transition về 0,01ms (không phải 0, để hộp thoại Base UI vẫn nhận `transitionend` và đóng được). Riêng vòng quay "đang xử lý" vẫn quay, chậm hơn.

### Biểu đồ

- Không dùng thư viện biểu đồ. Cột theo ngày (`daily-bars.tsx`) vẽ bằng SVG, nhãn trục là chữ HTML 12px để không bị thu nhỏ theo khung; trục giá trị rút gọn kiểu `850 N`, `12,5 Tr`.
- Cơ cấu (doanh thu theo kênh, phương thức, loại hàng; chi phí theo nhóm) dùng thanh ngang 100% (`charts/thanh-co-cau.tsx`), không dùng donut: dễ so trên màn hẹp. Kênh bán và loại hàng tô theo sắc ngữ nghĩa; mục không có nghĩa màu lấy màu theo thứ tự cố định để một mục giữ màu giữa các kỳ.
- Hình là minh họa (`aria-hidden`), số liệu đầy đủ luôn có ở dạng chữ bên cạnh (chú giải, bảng số liệu).

## 7. Nguyên tắc tâm lý và sinh lý người dùng

| Yếu tố | Áp dụng |
|---|---|
| UX/UI | 14 mục ngang cũ gom thành 5 nhóm theo công việc; một hành động chính mỗi màn; trạng thái rỗng có biểu tượng và lời giải thích; cảnh báo bấm được để đi thẳng tới nơi xử lý |
| Tâm lý | Xanh thương hiệu gợi tin cậy, ổn định khi xử lý tiền; màu trạng thái giữ nguyên nghĩa ở mọi trang nên không phải học lại; nhận ra bằng biểu tượng thay vì phải nhớ tên mục; lời chào theo tên tạo cảm giác quen thuộc |
| Sinh lý | Đứng quầy cả ca: nền trắng ngà giảm chói, chữ màu mực thay đen tuyền đỡ mỏi mắt; điện thoại một tay: tab ở đáy trong tầm ngón cái, vùng chạm từ 40px; số tiền cỡ lớn, chữ số đều để đọc nhanh |
| Design thinking | Vấn đề thật: nhân viên cần mở bán nhanh, quản lý cần thấy việc phải xử lý. Trang Tổng quan đặt đúng hai việc đó lên đầu |
| Gamification | Không áp dụng. Công cụ vận hành và xử lý tiền cần nghiêm túc, chính xác; huy hiệu hay điểm thưởng dễ gây sai lệch hành vi bán hàng |
| Data analytics | Chưa có số liệu sử dụng thật để đo. Đề xuất đo sau khi chạy: thời gian từ mở app đến giao dịch đầu tiên của ca, số lần sai khi thanh toán |
| Business | Nhận diện thống nhất trên app, icon điện thoại và hóa đơn in; không thêm chi phí vận hành |
| Accessibility | Tương phản đạt AA, trạng thái không chỉ bằng màu, mục đang chọn có vạch và chữ đậm, vòng focus rõ khi dùng bàn phím, biểu tượng trang trí có `aria-hidden` |

## 8. Việc còn lại

- Logo trên hóa đơn đã dùng bản đen thuần nhưng chưa thử trên máy in nhiệt thật (cửa hàng chưa có máy in).
- Các bảng còn cuộn ngang trên điện thoại, chuyển sang thẻ bằng `MobileCard` khi cần: giao dịch bán (danh sách, chi tiết), ca (danh sách, chi tiết), đơn online (danh sách, chi tiết), chuyển kho (danh sách, chi tiết), thu chi, đối soát, hạn sử dụng, cần nhập thêm, lịch sử biến động kho, nhà cung cấp, người dùng, chi tiết sản phẩm, gợi ý giá, import Excel.
- Chip lọc (`filter-chip.tsx`) cao khoảng 32px, dưới mức 44px; nên nâng khi rà lại màn Tồn kho.
- Một số helper chip đã khai nhưng chưa trang nào dùng: `ChipTrangThaiCa`, `ChipTrangThaiPhieu`, `sacTonKho`, `sacHan`, `sacTheoNhan`; màn ca và phiếu nhập vẫn dùng `Badge`. Giữ lại vì là bảng ánh xạ đã chốt ở mục 2; chuyển các `Badge` trạng thái sang chip khi rà lại các màn đó.
