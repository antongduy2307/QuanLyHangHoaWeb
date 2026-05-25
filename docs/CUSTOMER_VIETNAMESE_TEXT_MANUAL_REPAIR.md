# Customer Vietnamese Text Manual Repair

Date: 2026-05-23

Purpose: manual repair guide for Customer-module Vietnamese text after the failed automatic update. This report lists source UI lines with mojibake/mixed labels and customer-related test assertions that should be reapplied manually.

Important:

- Do not run broad search/replace on `frontend/src/app/App.test.tsx`.
- Restore `frontend/src/app/App.test.tsx` from git first, then reapply only the customer assertions listed below.
- Several customer source files still contain mojibake and should be edited manually in a UTF-8-safe editor.

## 1. Files With Mojibake Or Mixed Labels

Source UI files:

- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/features/customers/CustomerInlineDetailPanel.tsx`
- `frontend/src/features/customers/CustomerFormDialog.tsx`
- `frontend/src/features/customers/CustomerDetailPage.tsx`
- `frontend/src/features/customers/CustomerCreatePage.tsx`
- `frontend/src/features/customers/CustomerEditPage.tsx`
- `frontend/src/features/customers/DebtPaymentForm.tsx`
- `frontend/src/features/customers/customerSchemas.ts`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`

Test file:

- `frontend/src/app/App.test.tsx`

## 2. Source UI Text Repairs

| File | Line | Current text | Replacement text | Type | Note |
|---|---:|---|---|---|---|
| `frontend/src/features/customers/CustomerListPage.tsx` | 15 | `TÃªn A-Z` | `Tên A-Z` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 16 | `TÃªn Z-A` | `Tên Z-A` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 17 | `CÃ´ng ná»£ tÄƒng dáº§n` | `Công nợ tăng dần` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 18 | `CÃ´ng ná»£ giáº£m dáº§n` | `Công nợ giảm dần` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 19 | `Tá»•ng mua tÄƒng dáº§n` | `Tổng mua tăng dần` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 20 | `Tá»•ng mua giáº£m dáº§n` | `Tổng mua giảm dần` | source UI text | sort option |
| `frontend/src/features/customers/CustomerListPage.tsx` | 62 | `Khong the tai danh sach khach hang.` | `Không thể tải danh sách khách hàng.` | source UI text | error fallback |
| `frontend/src/features/customers/CustomerListPage.tsx` | 73 | `KhÃ¡ch hÃ ng` | `Khách hàng` | source UI text | title |
| `frontend/src/features/customers/CustomerListPage.tsx` | 74 | `Quáº£n lÃ½ há»“ sÆ¡ khÃ¡ch hÃ ng, cÃ´ng ná»£ hiá»‡n táº¡i vÃ  tá»•ng mua.` | `Quản lý hồ sơ khách hàng, công nợ hiện tại và tổng mua.` | source UI text | description |
| `frontend/src/features/customers/CustomerListPage.tsx` | 79 | `Bo loc khach hang` | `Bộ lọc khách hàng` | source UI text | aria label |
| `frontend/src/features/customers/CustomerListPage.tsx` | 82 | `Äiá»u khiá»ƒn` | `Điều khiển` | source UI text | section title |
| `frontend/src/features/customers/CustomerListPage.tsx` | 91 | `Táº¡o khÃ¡ch` | `Tạo khách` | source UI text | button |
| `frontend/src/features/customers/CustomerListPage.tsx` | 98 | `Sáº¯p xáº¿p` | `Sắp xếp` | source UI text | section title |
| `frontend/src/features/customers/CustomerListPage.tsx` | 99 | `lá»±a chá»n` | `lựa chọn` | source UI text | helper label |
| `frontend/src/features/customers/CustomerListPage.tsx` | 102 | `Thá»© tá»± hiá»ƒn thá»‹` | `Thứ tự hiển thị` | source UI text | label |
| `frontend/src/features/customers/CustomerListPage.tsx` | 115 | `Bá»™ lá»c` | `Bộ lọc` | source UI text | section title |
| `frontend/src/features/customers/CustomerListPage.tsx` | 116 | `CÃ´ng ná»£` | `Công nợ` | source UI text | badge |
| `frontend/src/features/customers/CustomerListPage.tsx` | 124 | `Chá»‰ hiá»‡n khÃ¡ch Ä‘ang ná»£` | `Chỉ hiện khách đang nợ` | source UI text | checkbox |
| `frontend/src/features/customers/CustomerListPage.tsx` | 132 | `Hiá»‡n khÃ¡ch ngá»«ng dÃ¹ng` | `Hiện khách ngừng dùng` | source UI text | checkbox |
| `frontend/src/features/customers/CustomerListPage.tsx` | 140 | `TÃ¬m kiáº¿m` | `Tìm kiếm` | source UI text | label |
| `frontend/src/features/customers/CustomerListPage.tsx` | 145 | `TÃ¬m theo tÃªn khÃ¡ch hÃ ng` | `Tìm theo tên khách hàng` | source UI text | placeholder |
| `frontend/src/features/customers/CustomerListPage.tsx` | 151 | `Äang táº£i danh sÃ¡ch khÃ¡ch hÃ ng...` | `Đang tải danh sách khách hàng...` | source UI text | loading |
| `frontend/src/features/customers/CustomerListPage.tsx` | 154 | `ChÆ°a cÃ³ khÃ¡ch hÃ ng phÃ¹ há»£p.` | `Chưa có khách hàng phù hợp.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerListPage.tsx` | 161 | `khÃ¡ch hÃ ng Ä‘ang hiá»ƒn thá»‹` | `khách hàng đang hiển thị` | source UI text | status text |
| `frontend/src/features/customers/CustomerListPage.tsx` | 162 | `Äang chá»n` | `Đang chọn` | source UI text | selection text |
| `frontend/src/features/customers/CustomerListPage.tsx` | 164 | `Tá»•ng há»£p tá»« káº¿t quáº£ hiá»‡n táº¡i` | `Tổng hợp từ kết quả hiện tại` | source UI text | selection bar |
| `frontend/src/features/customers/CustomerListPage.tsx` | 170 | `TÃªn khÃ¡ch` | `Tên khách` | source UI text | table header |
| `frontend/src/features/customers/CustomerListPage.tsx` | 171 | `Äiá»‡n thoáº¡i` | `Điện thoại` | source UI text | table header |
| `frontend/src/features/customers/CustomerListPage.tsx` | 172 | `CÃ´ng ná»£` | `Công nợ` | source UI text | table header |
| `frontend/src/features/customers/CustomerListPage.tsx` | 173 | `Tá»•ng mua` | `Tổng mua` | source UI text | table header |
| `frontend/src/features/customers/CustomerListPage.tsx` | 178 | `Tá»•ng cá»™ng` | `Tổng cộng` | source UI text | summary row |
| `frontend/src/features/customers/CustomerListPage.tsx` | 204 | `Ngá»«ng dÃ¹ng` | `Ngừng dùng` | source UI text | inactive badge |

| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 43 | `KhÃ¡ch cÃ²n ná»£` | `Khách còn nợ` | source UI text | balance status |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 46 | `KhÃ¡ch tráº£ trÆ°á»›c` | `Khách trả trước` | source UI text | balance status |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 48 | `CÃ¢n báº±ng` | `Cân bằng` | source UI text | balance status |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 81 | `BÃ¡n hÃ ng` | `Bán hàng` | source UI text | timeline label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 84 | `Tráº£ hÃ ng` | `Trả hàng` | source UI text | timeline label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 87 | `Ná»£ Ä‘áº§u ká»³` | `Nợ đầu kỳ` | source UI text | timeline label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 90 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` | source UI text | timeline label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 93 | `Thanh toÃ¡n hÃ³a Ä‘Æ¡n` / `Tráº£ ná»£` | `Thanh toán hóa đơn` / `Trả nợ` | source UI text | timeline label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 127 | `BÃ¡n hÃ ng` | `Bán hàng` | source UI text | trade history |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 136 | `Tráº£ hÃ ng` | `Trả hàng` | source UI text | trade history |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 251 | `Da dieu chinh cong no.` | `Đã điều chỉnh công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 253 | `KhÃ´ng thá»ƒ Ä‘iá»u chá»‰nh cÃ´ng ná»£.` | `Không thể điều chỉnh công nợ.` | source UI text | error |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 258 | `XÃ³a thanh toÃ¡n cÃ´ng ná»£ nÃ y?` | `Xóa thanh toán công nợ này?` | source UI text | confirm |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 265 | `Da xoa thanh toan cong no.` | `Đã xóa thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 267 | `KhÃ´ng thá»ƒ xÃ³a thanh toÃ¡n.` | `Không thể xóa thanh toán.` | source UI text | error |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 272 | `Chi tiet khach hang` | `Chi tiết khách hàng` | source UI text | aria label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 273 | `Chi tiet khach hang` | `Chi tiết khách hàng` | source UI text | aria label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 284 | `ThÃ´ng tin chung` | `Thông tin chung` | source UI text | tab |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 286 | `Lá»‹ch sá»­ bÃ¡n/tráº£ hÃ ng` | `Lịch sử bán/trả hàng` | source UI text | tab |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 287 | `Ná»£ cáº§n thu tá»« khÃ¡ch` | `Nợ cần thu từ khách` | source UI text | tab |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 292 | `Äang táº£i chi tiáº¿t khÃ¡ch hÃ ng...` | `Đang tải chi tiết khách hàng...` | source UI text | loading |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 295 | `KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u chi tiáº¿t khÃ¡ch hÃ ng.` | `Không thể tải dữ liệu chi tiết khách hàng.` | source UI text | error |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 304 | `ThÃ´ng tin chung` | `Thông tin chung` | source UI text | section title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 305 | `Há»“ sÆ¡ tá»•ng quan vÃ  thao tÃ¡c nhanh` | `Hồ sơ tổng quan và thao tác nhanh` | source UI text | section subtitle |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 309 | `TÃªn khÃ¡ch hÃ ng` | `Tên khách hàng` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 313 | `Äiá»‡n thoáº¡i` | `Điện thoại` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 317 | `CÃ´ng ná»£ hiá»‡n táº¡i` | `Công nợ hiện tại` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 321 | `Tá»•ng mua` | `Tổng mua` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 325 | `Äá»‹a chá»‰` | `Địa chỉ` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 329 | `Ghi chÃº` | `Ghi chú` | source UI text | label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 335 | `Má»Ÿ chi tiáº¿t` | `Mở chi tiết` | source UI text | action |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 340, 344 | `Sá»­a khÃ¡ch hÃ ng` | `Sửa khách hàng` | source UI text | action |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 355 | `Lá»‹ch sá»­ bÃ¡n/tráº£ hÃ ng` | `Lịch sử bán/trả hàng` | source UI text | section title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 356 | `Giao dá»‹ch gáº§n nháº¥t cá»§a khÃ¡ch` | `Giao dịch gần nhất của khách` | source UI text | section subtitle |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 358 | `ChÆ°a cÃ³ lá»‹ch sá»­ bÃ¡n hoáº·c tráº£ hÃ ng.` | `Chưa có lịch sử bán hoặc trả hàng.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 364-369 | `Thá»i gian`, `Loáº¡i giao dá»‹ch`, `MÃ£ phiáº¿u`, `HÃ ng Ä‘Ã£ giao dá»‹ch`, `GiÃ¡ trá»‹`, `Má»Ÿ` | `Thời gian`, `Loại giao dịch`, `Mã phiếu`, `Hàng đã giao dịch`, `Giá trị`, `Mở` | source UI text | table headers |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 398 | `Ná»£ cáº§n thu hiá»‡n táº¡i` | `Nợ cần thu hiện tại` | source UI text | balance bar |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 405 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` | source UI text | action |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 412 | `Thanh toÃ¡n` | `Thanh toán` | source UI text | action |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 423 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` | source UI text | form title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 426 | `CÃ´ng ná»£ hiá»‡n táº¡i` | `Công nợ hiện tại` | source UI text | preview |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 430 | `CÃ´ng ná»£ má»¥c tiÃªu` | `Công nợ mục tiêu` | source UI text | preview |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 434 | `PhÃ¡t sinh dá»± kiáº¿n` | `Phát sinh dự kiến` | source UI text | preview |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 441 | `CÃ´ng ná»£ má»¥c tiÃªu` | `Công nợ mục tiêu` | source UI text | field label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 451 | `Ghi chÃº` | `Ghi chú` | source UI text | field label |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 454 | `Äiá»u chá»‰nh nÃ y Ä‘áº·t láº¡i cÃ´ng ná»£ má»¥c tiÃªu vÃ  váº«n ghi nháº­n qua balance-adjustment hiá»‡n cÃ³.` | `Điều chỉnh này đặt lại công nợ mục tiêu và vẫn ghi nhận qua balance-adjustment hiện có.` | source UI text | hint |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 458 | `Äang lÆ°u...` / `LÆ°u Ä‘iá»u chá»‰nh` | `Đang lưu...` / `Lưu điều chỉnh` | source UI text | button |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 461 | `Há»§y` | `Hủy` | source UI text | button |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 470 | `Ghi nháº­n thanh toÃ¡n` | `Ghi nhận thanh toán` | source UI text | button |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 479 | `ÄÃ£ thÃªm thanh toÃ¡n cÃ´ng ná»£.` | `Đã thêm thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 489 | `Sá»­a thanh toÃ¡n` | `Sửa thanh toán` | source UI text | form title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 494 | `LÆ°u thanh toÃ¡n` | `Lưu thanh toán` | source UI text | button |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 503 | `ÄÃ£ cáº­p nháº­t thanh toÃ¡n cÃ´ng ná»£.` | `Đã cập nhật thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 515 | `Thanh toÃ¡n cÃ´ng ná»£` | `Thanh toán công nợ` | source UI text | section title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 516 | `ThÃªm, sá»­a hoáº·c xÃ³a phiáº¿u thanh toÃ¡n` | `Thêm, sửa hoặc xóa phiếu thanh toán` | source UI text | subtitle |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 519 | `ChÆ°a cÃ³ thanh toÃ¡n cÃ´ng ná»£.` | `Chưa có thanh toán công nợ.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 526-530 | `MÃ£ phiáº¿u`, `Sá»‘ tiá»n thanh toÃ¡n`, `Thá»i gian`, `Ghi chÃº`, `Thao tÃ¡c` | `Mã phiếu`, `Số tiền thanh toán`, `Thời gian`, `Ghi chú`, `Thao tác` | source UI text | table headers |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 544, 547 | `Sá»­a`, `XÃ³a` | `Sửa`, `Xóa` | source UI text | row actions |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 562 | `Lá»‹ch sá»­ cÃ´ng ná»£` | `Lịch sử công nợ` | source UI text | section title |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 563 | `ÄÆ°á»£c sáº¯p theo ledger hiá»‡n cÃ³` | `Được sắp theo ledger hiện có` | source UI text | subtitle |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 565 | `ChÆ°a cÃ³ lá»‹ch sá»­ cÃ´ng ná»£.` | `Chưa có lịch sử công nợ.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerInlineDetailPanel.tsx` | 571-576 | `Thá»i gian`, `Diá»…n giáº£i`, `Tham chiáº¿u`, `PhÃ¡t sinh`, `DÆ° ná»£ khÃ¡ch hÃ ng`, `Ghi chÃº` | `Thời gian`, `Diễn giải`, `Tham chiếu`, `Phát sinh`, `Dư nợ khách hàng`, `Ghi chú` | source UI text | table headers |

| `frontend/src/features/customers/CustomerFormDialog.tsx` | 66-67 | `KhÃ´ng thá»ƒ cáº­p nháº­t khÃ¡ch hÃ ng.` / `KhÃ´ng thá»ƒ táº¡o khÃ¡ch hÃ ng.` | `Không thể cập nhật khách hàng.` / `Không thể tạo khách hàng.` | source UI text | error fallback |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 85 | `Sá»­a khÃ¡ch hÃ ng` / `Táº¡o khÃ¡ch hÃ ng` | `Sửa khách hàng` / `Tạo khách hàng` | source UI text | title |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 86 | `Cáº­p nháº­t thÃ´ng tin vÃ  cÃ´ng ná»£ má»¥c tiÃªu.` / `Táº¡o há»“ sÆ¡ khÃ¡ch hÃ ng vÃ  sá»‘ dÆ° ban Ä‘áº§u náº¿u cÃ³.` | `Cập nhật thông tin và công nợ mục tiêu.` / `Tạo hồ sơ khách hàng và số dư ban đầu nếu có.` | source UI text | description |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 89 | `ÄÃ³ng` | `Đóng` | source UI text | button |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 96 | `TÃªn khÃ¡ch hÃ ng` | `Tên khách hàng` | source UI text | label |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 101 | `Äiá»‡n thoáº¡i` | `Điện thoại` | source UI text | label |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 105 | `Äá»‹a chá»‰` | `Địa chỉ` | source UI text | label |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 109 | `Ghi chÃº` | `Ghi chú` | source UI text | label |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 113 | `CÃ´ng ná»£ má»¥c tiÃªu` / `Sá»‘ dÆ° ban Ä‘áº§u` | `Công nợ mục tiêu` / `Số dư ban đầu` | source UI text | label |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 123 | `Tá»•ng mua` | `Tổng mua` | source UI text | metric |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 133 | `Há»§y` | `Hủy` | source UI text | button |
| `frontend/src/features/customers/CustomerFormDialog.tsx` | 136 | `Äang lÆ°u`, `Äang táº¡o`, `LÆ°u khÃ¡ch hÃ ng`, `Táº¡o khÃ¡ch hÃ ng` | `Đang lưu`, `Đang tạo`, `Lưu khách hàng`, `Tạo khách hàng` | source UI text | button text |

| `frontend/src/features/customers/CustomerDetailPage.tsx` | 52 | `MÃ£ khÃ¡ch hÃ ng khÃ´ng há»£p lá»‡.` | `Mã khách hàng không hợp lệ.` | source UI text | error |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 56 | `KhÃ´ng thá»ƒ táº£i chi tiáº¿t khÃ¡ch hÃ ng.` | `Không thể tải chi tiết khách hàng.` | source UI text | error |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 76 | `ÄÃ£ Ä‘iá»u chá»‰nh cÃ´ng ná»£.` | `Đã điều chỉnh công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 78 | `KhÃ´ng thá»ƒ Ä‘iá»u chá»‰nh cÃ´ng ná»£.` | `Không thể điều chỉnh công nợ.` | source UI text | error |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 83 | `XÃ³a thanh toÃ¡n cÃ´ng ná»£ nÃ y?` | `Xóa thanh toán công nợ này?` | source UI text | confirm |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 90 | `ÄÃ£ xÃ³a thanh toÃ¡n cÃ´ng ná»£.` | `Đã xóa thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 92 | `KhÃ´ng thá»ƒ xÃ³a thanh toÃ¡n.` | `Không thể xóa thanh toán.` | source UI text | error |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 97 | `XÃ³a hoáº·c ngá»«ng dÃ¹ng khÃ¡ch hÃ ng nÃ y?` | `Xóa hoặc ngừng dùng khách hàng này?` | source UI text | confirm |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 107-108 | `KhÃ¡ch hÃ ng Ä‘Ã£ Ä‘Æ°á»£c xÃ³a vÄ©nh viá»…n.` / `KhÃ¡ch hÃ ng Ä‘Ã£ Ä‘Æ°á»£c ngá»«ng dÃ¹ng.` | `Khách hàng đã được xóa vĩnh viễn.` / `Khách hàng đã được ngừng dùng.` | source UI text | result message |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 112 | `KhÃ´ng thá»ƒ xÃ³a khÃ¡ch hÃ ng.` | `Không thể xóa khách hàng.` | source UI text | error |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 118 | `Chi tiáº¿t khÃ¡ch hÃ ng` | `Chi tiết khách hàng` | source UI text | title |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 119 | `ThÃ´ng tin há»“ sÆ¡ vÃ  lá»‹ch sá»­ ledger cÃ´ng ná»£.` | `Thông tin hồ sơ và lịch sử ledger công nợ.` | source UI text | description |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 128 | `Sá»­a khÃ¡ch hÃ ng` | `Sửa khách hàng` | source UI text | action |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 131 | `XÃ³a khÃ¡ch hÃ ng` | `Xóa khách hàng` | source UI text | action |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 136 | `Quay láº¡i` | `Quay lại` | source UI text | action |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 142 | `Äang táº£i chi tiáº¿t khÃ¡ch hÃ ng...` | `Đang tải chi tiết khách hàng...` | source UI text | loading |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 149 | `ThÃ´ng tin khÃ¡ch hÃ ng` | `Thông tin khách hàng` | source UI text | aria label |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 151-171 | `TÃªn khÃ¡ch hÃ ng`, `Äiá»‡n thoáº¡i`, `Sá»‘ dÆ°`, `Tá»•ng mua`, `Äá»‹a chá»‰`, `Ghi chÃº` | `Tên khách hàng`, `Điện thoại`, `Số dư`, `Tổng mua`, `Địa chỉ`, `Ghi chú` | source UI text | labels |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 178-180 | `Thanh toÃ¡n cÃ´ng ná»£` | `Thanh toán công nợ` | source UI text | title/aria |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 183 | `ThÃªm thanh toÃ¡n` | `Thêm thanh toán` | source UI text | button |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 192, 198 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` | source UI text | button/title |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 200 | `Sá»‘ dÆ° má»¥c tiÃªu` | `Số dư mục tiêu` | source UI text | field label |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 210 | `Ghi chÃº` | `Ghi chú` | source UI text | field label |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 216 | `Äang lÆ°u...` / `LÆ°u Ä‘iá»u chá»‰nh` | `Đang lưu...` / `Lưu điều chỉnh` | source UI text | button |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 219 | `Há»§y` | `Hủy` | source UI text | button |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 227 | `ThÃªm thanh toÃ¡n` | `Thêm thanh toán` | source UI text | submit label |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 236 | `ÄÃ£ thÃªm thanh toÃ¡n cÃ´ng ná»£.` | `Đã thêm thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 243 | `ChÆ°a cÃ³ thanh toÃ¡n cÃ´ng ná»£.` | `Chưa có thanh toán công nợ.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 249-254 | `MÃ£`, `Sá»‘ tiá»n`, `Thá»i gian`, `Ghi chÃº`, `Tráº¡ng thÃ¡i`, `Thao tÃ¡c` | `Mã`, `Số tiền`, `Thời gian`, `Ghi chú`, `Trạng thái`, `Thao tác` | source UI text | headers |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 264 | `ÄÃ£ xÃ³a` / `Äang hiá»‡u lá»±c` | `Đã xóa` / `Đang hiệu lực` | source UI text | status |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 269, 272 | `Sá»­a`, `XÃ³a` | `Sửa`, `Xóa` | source UI text | actions |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 285 | `Sá»­a thanh toÃ¡n` | `Sửa thanh toán` | source UI text | form title |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 290 | `LÆ°u thanh toÃ¡n` | `Lưu thanh toán` | source UI text | submit label |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 299 | `ÄÃ£ cáº­p nháº­t thanh toÃ¡n cÃ´ng ná»£.` | `Đã cập nhật thanh toán công nợ.` | source UI text | success |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 310 | `ChÆ°a cÃ³ ledger cÃ´ng ná»£.` | `Chưa có ledger công nợ.` | source UI text | empty state |
| `frontend/src/features/customers/CustomerDetailPage.tsx` | 316-321 | `Thá»i gian`, `Sá»± kiá»‡n`, `Tham chiáº¿u`, `PhÃ¡t sinh`, `Sá»‘ dÆ° sau`, `Ghi chÃº` | `Thời gian`, `Sự kiện`, `Tham chiếu`, `Phát sinh`, `Số dư sau`, `Ghi chú` | source UI text | headers |

| `frontend/src/features/customers/CustomerCreatePage.tsx` | 10 | `Táº¡o khÃ¡ch hÃ ng` / `Táº¡o há»“ sÆ¡ khÃ¡ch hÃ ng vÃ  sá»‘ dÆ° ban Ä‘áº§u náº¿u cÃ³.` | `Tạo khách hàng` / `Tạo hồ sơ khách hàng và số dư ban đầu nếu có.` | source UI text | shell title/description |

| `frontend/src/features/customers/CustomerEditPage.tsx` | 13 | `KhÃ´ng thá»ƒ táº£i khÃ¡ch hÃ ng.` | `Không thể tải khách hàng.` | source UI text | error |
| `frontend/src/features/customers/CustomerEditPage.tsx` | 16 | `MÃ£ khÃ¡ch hÃ ng khÃ´ng há»£p lá»‡.` | `Mã khách hàng không hợp lệ.` | source UI text | error |
| `frontend/src/features/customers/CustomerEditPage.tsx` | 20 | `Äang táº£i khÃ¡ch hÃ ng...` | `Đang tải khách hàng...` | source UI text | loading |
| `frontend/src/features/customers/CustomerEditPage.tsx` | 32 | `Sá»­a khÃ¡ch hÃ ng` / `Cáº­p nháº­t thÃ´ng tin vÃ  cÃ´ng ná»£ má»¥c tiÃªu.` | `Sửa khách hàng` / `Cập nhật thông tin và công nợ mục tiêu.` | source UI text | shell title/description |

| `frontend/src/features/customers/DebtPaymentForm.tsx` | 67 | `Sá»‘ tiá»n thanh toÃ¡n pháº£i lá»›n hÆ¡n 0.` | `Số tiền thanh toán phải lớn hơn 0.` | source UI text | validation |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 88 | `CÃ´ng ná»£ hiá»‡n táº¡i` | `Công nợ hiện tại` | source UI text | preview |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 92 | `Æ¯á»›c tÃ­nh sau thanh toÃ¡n` | `Ước tính sau thanh toán` | source UI text | preview |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 98 | `Sá»‘ tiá»n thanh toÃ¡n` | `Số tiền thanh toán` | source UI text | label |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 102 | `Thá»i gian thanh toÃ¡n` | `Thời gian thanh toán` | source UI text | label |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 110 | `Ghi chÃº` | `Ghi chú` | source UI text | label |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 118 | `Há»§y` | `Hủy` | source UI text | button |
| `frontend/src/features/customers/DebtPaymentForm.tsx` | 122 | `Äang lÆ°u` | `Đang lưu` | source UI text | button |

| `frontend/src/features/customers/customerSchemas.ts` | 32 | `TÃªn khÃ¡ch hÃ ng lÃ  báº¯t buá»™c.` | `Tên khách hàng là bắt buộc.` | source UI text | validation |
| `frontend/src/features/customers/customerSchemas.ts` | 35 | `Sá»‘ dÆ° ban Ä‘áº§u pháº£i lÃ  sá»‘ há»£p lá»‡.` | `Số dư ban đầu phải là số hợp lệ.` | source UI text | validation |
| `frontend/src/features/customers/customerSchemas.ts` | 64 | `TÃªn khÃ¡ch hÃ ng lÃ  báº¯t buá»™c.` | `Tên khách hàng là bắt buộc.` | source UI text | validation |

| `frontend/src/features/inventory/InventoryModuleShell.tsx` | 14 | `Khach hang` | `Khách hàng` | source UI text | shared shell nav label only if user wants shell nav diacritics too |

## 3. Test Assertions To Reapply Manually

Restore `frontend/src/app/App.test.tsx` from git first.

After restore, reapply only the customer-related assertion updates below.

| File | Line (current/approx after restore) | Current text/assertion | Replacement text/assertion | Type | Note |
|---|---:|---|---|---|---|
| `frontend/src/app/App.test.tsx` | 328 | `note: "Khach hang than thiet"` | `note: "Khách hàng thân thiết"` | test fixture | customer fixture |
| `frontend/src/app/App.test.tsx` | 672, 682, 899, 914, 935, 981, 1118, 1298 | `Khach hang` | `Khách hàng` | test assertion | customer route heading/link |
| `frontend/src/app/App.test.tsx` | 848 | `Dang tai danh sach khach hang...` | `Đang tải danh sách khách hàng...` | test assertion | loading state |
| `frontend/src/app/App.test.tsx` | 865 | `Chua co khach hang phu hop.` | `Chưa có khách hàng phù hợp.` | test assertion | empty state |
| `frontend/src/app/App.test.tsx` | 900 | placeholder `Ten, dien thoai` | `Tìm theo tên khách hàng` | test assertion | customer search |
| `frontend/src/app/App.test.tsx` | 925, 930, 936, 951, 962, 976, 979 | `Táº¡o khÃ¡ch hÃ ng` | `Tạo khách hàng` | test assertion | modal/create route |
| `frontend/src/app/App.test.tsx` | 954 | `Ten khach hang la bat buoc.` | `Tên khách hàng là bắt buộc.` | test assertion | validation |
| `frontend/src/app/App.test.tsx` | 963, 977, 1047, 1048 | `Ten khach hang` | `Tên khách hàng` | test assertion | field label |
| `frontend/src/app/App.test.tsx` | 964, 965 | `So du ban dau` | `Số dư ban đầu` | test assertion | field label |
| `frontend/src/app/App.test.tsx` | 968 | `So du ban dau phai la so hop le.` | `Số dư ban đầu phải là số hợp lệ.` | test assertion | validation |
| `frontend/src/app/App.test.tsx` | 978, 1049, 1050 | `Dien thoai` | `Điện thoại` | test assertion | field label |
| `frontend/src/app/App.test.tsx` | 999 | `Tien mat` | `Tiền mặt` | test assertion | debt payment note |
| `frontend/src/app/App.test.tsx` | 1009, 1016, 1024, 1045 | `Sua khach hang` | `Sửa khách hàng` | test assertion | action/heading |
| `frontend/src/app/App.test.tsx` | 1010, 1017, 1025, 1105, 1116 | `Xoa khach hang` | `Xóa khách hàng` | test assertion | action |
| `frontend/src/app/App.test.tsx` | 1011, 1018, 1026, 1147 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` | test assertion | action |
| `frontend/src/app/App.test.tsx` | 1023, 1053 | `Chi tiet khach hang` | `Chi tiết khách hàng` | test assertion | heading |
| `frontend/src/app/App.test.tsx` | 1036, 1060 | `Khach hang than thiet` | `Khách hàng thân thiết` | test fixture/assertion | note |
| `frontend/src/app/App.test.tsx` | 1087, 1051 | `Luu khach hang` | `Lưu khách hàng` | test assertion | submit |
| `frontend/src/app/App.test.tsx` | 1119 | `Khach hang da duoc ngung dung.` | `Khách hàng đã được ngừng dùng.` | test assertion | delete result |
| `frontend/src/app/App.test.tsx` | 1127-1129, 1137, 1176, 1178, 1194, 1196, 1225, 1227 | `Them thanh toan` | `Thêm thanh toán` | test assertion | debt payment buttons |
| `frontend/src/app/App.test.tsx` | 1128, 1138, 1237, 1238 | `Sua` | `Sửa` | test assertion | debt row action |
| `frontend/src/app/App.test.tsx` | 1130, 1139, 1254, 1265, 1299 | `Xoa` | `Xóa` | test assertion | debt row action |
| `frontend/src/app/App.test.tsx` | 1148-1149 | `So du muc tieu` | `Số dư mục tiêu` or `Công nợ mục tiêu` | test assertion | align with final source choice |
| `frontend/src/app/App.test.tsx` | 1150, 151? | `Ghi chu` | `Ghi chú` | test assertion | field label |
| `frontend/src/app/App.test.tsx` | 1151 | `Luu dieu chinh` | `Lưu điều chỉnh` | test assertion | submit |
| `frontend/src/app/App.test.tsx` | 1168 | `Da dieu chinh cong no.` | `Đã điều chỉnh công nợ.` | test assertion | success |
| `frontend/src/app/App.test.tsx` | 1177, 1195, 1238 | `So tien thanh toan` | `Số tiền thanh toán` | test assertion | field label |
| `frontend/src/app/App.test.tsx` | 1186 | `Da them thanh toan cong no.` | `Đã thêm thanh toán công nợ.` | test assertion | success |
| `frontend/src/app/App.test.tsx` | 1198 | `So tien thanh toan phai lon hon 0.` | `Số tiền thanh toán phải lớn hơn 0.` | test assertion | validation |
| `frontend/src/app/App.test.tsx` | 1244 | `Ngung dung` | `Ngừng dùng` | test assertion | inactive badge |

## 4. Structurally Corrupted Test Blocks

`frontend/src/app/App.test.tsx` should be restored from git before manual reapplication.

The following customer block is especially risky and should be rechecked after restore:

- customer create/edit modal assertions
- customer debt payment create/edit/delete assertions
- customer balance adjustment assertions

Reapply customer-only assertion text after restore. Do not broad-replace other modules.

## 5. Recommendation

1. Restore `frontend/src/app/App.test.tsx` from git.
2. Manually fix the customer source files above in a UTF-8-safe editor.
3. Reapply only the customer-related assertion changes listed in section 3.
4. Then run:
   - `npm.cmd test -- --run`
   - `npm.cmd run build`
   - `npm.cmd run lint`
