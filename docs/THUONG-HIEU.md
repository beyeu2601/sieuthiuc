# Bộ nhận diện và nguyên tắc giao diện Siêu Thị Úc

Tài liệu cho người phát triển và người thiết kế. Mọi màu, chữ, kích thước trong app lấy từ đây; đổi ở `src/app/globals.css` thay vì ghi cứng trong trang.

## Table of Contents

- [1. Phân tích logo](#1-phân-tích-logo)
- [2. Màu](#2-màu)
- [3. Chữ](#3-chữ)
- [4. Tệp logo và icon](#4-tệp-logo-và-icon)
- [5. Bố cục và điều hướng](#5-bố-cục-và-điều-hướng)
- [6. Kích thước và vùng chạm](#6-kích-thước-và-vùng-chạm)
  - [Chế độ tối](#chế-độ-tối)
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

- Chỉ một màu nhấn là xanh thương hiệu. Xanh lá, cam, đỏ dành riêng cho trạng thái, không dùng để trang trí.
- Trạng thái luôn đi kèm chữ hoặc biểu tượng, không chỉ dựa vào màu (người mù màu vẫn đọc được).
- Mọi cặp chữ và nền đạt WCAG AA (từ 4,5:1).

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

Ô tên sản phẩm trong bảng được xuống dòng để các cột giá, tồn luôn nằm trong màn hình. Trên điện thoại (dưới 768px), bảng Tồn kho và Nhập xuất tồn chuyển thành thẻ: tên và trạng thái ở trên, số liệu có nhãn ở dưới (`src/components/mobile-card.tsx`).

### Chế độ tối

- Mặc định theo cài đặt của máy; người dùng chọn Sáng, Tối hoặc Theo máy trong menu tài khoản. Lựa chọn lưu ở trình duyệt (`localStorage`), áp dụng trước khi vẽ trang nên không nháy màu (`src/components/theme.tsx`).
- Cùng hệ màu, chọn lại bước sáng tối chứ không đảo tự động. Trên nền tối `--brand` (chữ, biểu tượng) là `#9DB0F0`, tách khỏi `--primary` (nền nút) là `#3A56B4`.
- Tương phản trên nền tối: chữ 13,9-15,2:1, chữ phụ 7,4:1, nút xanh chữ trắng 6,6:1, màu trạng thái từ 7:1.
- Dùng khi làm việc buổi tối hoặc chỗ thiếu sáng; tại quầy sáng đèn nên giữ chế độ sáng.

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
- Các bảng khác (giao dịch, công nợ, phiếu nhập) trên điện thoại vẫn cuộn ngang; chuyển sang thẻ bằng `MobileCard` khi cần.
