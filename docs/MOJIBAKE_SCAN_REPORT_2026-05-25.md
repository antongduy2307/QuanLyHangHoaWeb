# Mojibake Scan Report

Date: 2026-05-25

## Scope

- I did not modify source files.
- I manually inspected `frontend/src/features/sales/InvoiceCreatePage.tsx`.
- I then scanned source files for mojibake markers such as the severe `AAaAa...` corruption and the classic `Ã...`/`�` UTF-8 misdecode pattern.
- I excluded dependency/cache noise such as `.venv/` and `.uv-cache/`.

## 1. `InvoiceCreatePage.tsx` manual repair map

File: `frontend/src/features/sales/InvoiceCreatePage.tsx`

The file is not affected by one isolated typo. It contains repeated corrupted UI labels, validation text, button text, aria labels, and fallback messages. The safest way to repair it is by replacing the repeated literals below.

| Lines | What is corrupted now | Replace with |
| --- | --- | --- |
| 136 | column labels | `["STT", "", "Mã hàng", "Tên hàng", "Loại/Đơn vị", "Số lượng", "Đơn giá", "Thành tiền"]` |
| 167, 185, 343, 449, 470, 504, 874, 970, 1053, 1125 | walk-in customer literal `Kha...le...` | `Khách lẻ` |
| 210 | edit tab label | `` `Sửa ${draft.invoiceCode}` `` |
| 212, 1209, 1217, 1248 | sale tab / shell title `BAAa... h...ng` | `Bán hàng` |
| 215, 1978 | linked return label | `Trả hàng theo hóa đơn` |
| 218, 1878 | order label | `Đặt hàng` |
| 220, 1662, 1978 | quick return label | `Trả hàng nhanh` |
| 314 | order validation message | `Thời gian đặt hàng là bắt buộc.` |
| 317 | order validation message | `Ngày cần giao là bắt buộc.` |
| 320 | order validation message | `Đơn đặt hàng cần ít nhất một mặt hàng.` |
| 327, 422 | item validation message | `Cần chọn hàng hóa.` |
| 330, 425 | item validation message | `Cần chọn đơn vị.` |
| 333, 417 | quantity validation message | `Số lượng phải lớn hơn 0.` |
| 397 | return validation message | `Thời gian trả hàng là bắt buộc.` |
| 400 | return validation message | `Cần chọn hóa đơn gốc.` |
| 403 | return validation message | `Phiếu trả cần ít nhất một mặt hàng.` |
| 406 | return validation message | `Phiếu trả khách lẻ chỉ được hoàn tiền ngay.` |
| 409 | return validation message | `Hóa đơn khách lẻ chỉ được hoàn tiền ngay.` |
| 428 | unit price validation message | `Đơn giá phải là số không âm.` |
| 433 | linked-return line validation | `Cần chọn dòng hóa đơn gốc.` |
| 435 | linked-return quantity validation | `Số lượng trả không được vượt quá số lượng còn lại.` |
| 761 | edit hydration fallback error | `Không thể tải hóa đơn để mở tab sửa.` |
| 1138, 1140 | sale edit success message / route state | `Đã cập nhật hóa đơn.` |
| 1149 | sale create success message | `Đã thanh toán hóa đơn.` |
| 1157 | sale edit fallback error | `Không thể cập nhật hóa đơn.` |
| 1158 | sale create fallback error | `Không thể thanh toán hóa đơn.` |
| 1179 | return success message | `Đã tạo phiếu trả hàng.` |
| 1181 | return fallback error | `Không thể tạo phiếu trả hàng.` |
| 1201 | order success message | `Đã lưu đơn đặt hàng.` |
| 1203 | order fallback error | `Không thể lưu đơn đặt hàng.` |
| 1225 | ASCII-corrupted shell title `BAn hAng` | `Bán hàng` |
| 1227 | ASCII-corrupted loading text | `Đang tải hóa đơn cần sửa...` |
| 1232 | ASCII-corrupted button text | `Thử lại` |
| 1239 | ASCII-corrupted link text | `Quay lại` |
| 1255 | main workspace aria label | `Khu vực lập hóa đơn` |
| 1260, 1261, 1302 | sale product search label / placeholder | `Tìm hàng hóa` |
| 1267, 1268 | linked return source-invoice search label / placeholder | `Nhập mã hóa đơn nguồn` |
| 1279, 1280, 1291, 1292 | quick-return / order product search label / placeholder | `Tìm theo tên hàng` |
| 1305 | sale product result list aria label | `Kết quả hàng hóa` |
| 1613 | linked return table aria label | `Dòng trả hàng theo hóa đơn` |
| 1615 | linked return table headers | `["Mã hàng", "Tên hàng", "Đơn vị", "Đã mua", "Đã trả", "Còn lại", "Trả lần này", "Đơn giá", "Thành tiền"]` |
| 1665 | quick return table aria label | `Dòng trả hàng nhanh` |
| 1667 | quick return table headers | `["Tên hàng", "Đơn vị", "Số lượng", "Đơn giá", "Thành tiền", "Xóa"]` |
| 1737 | icon-only delete literal | `×` |
| 1746 | quick return empty state | `Chưa có hàng hóa trong phiếu trả.` |
| 1755, 1761 | return note label / placeholder | `Ghi chú trả hàng` |
| 1770 | sale-side aria label | `Thanh toán` |
| 1772 | edit banner aria label | `Trạng thái sửa hóa đơn` |
| 1773 | edit badge text | `Đang sửa hóa đơn` |
| 1774 | edit fallback invoice label | `` `Hóa đơn #${activeSaleDraft.invoiceId}` `` |
| 1780, 1881, 1983 | customer field label | `Khách hàng` |
| 1782, 1783, 1884, 1986 | customer search placeholder / aria label | `Tìm khách hàng` |
| 1789, 1895, 1997 | customer result list aria label | `Kết quả khách hàng` |
| 1793, 1804, 1899, 1910, 2001, 2020 | phone fallback | `Không có SĐT` |
| 1807, 1913, 2023 | clear-customer button | `Bỏ chọn` |
| 1809, 1915, 2025 | balance label | `Công nợ hiện tại` |
| 1812, 1918, 2028 | walk-in label | `Khách lẻ` |
| 1816 | invoice datetime label | `Thời gian hóa đơn` |
| 1827 | sale summary label | `Tổng tiền hàng` |
| 1831 | sale summary label | `Khách cần trả` |
| 1835, 1837 | paid amount label / aria label | `Khách thanh toán` |
| 1845 | payment delta labels | `selectedCustomer ? "Thanh toán thừa / ghi vào công nợ" : "Tiền thừa"` |
| 1860 | pending edit button text | `Đang cập nhật` |
| 1861 | edit submit button text | `Cập nhật hóa đơn` |
| 1863 | pending sale submit button text | `Đang thanh toán` |
| 1864 | sale submit button text | `Thanh toán` |
| 1868 | cancel-edit button text | `Hủy sửa` |
| 1872 | invoices link text | `Xem danh sách hóa đơn` |
| 1877 | order-side aria label | `Thông tin đặt hàng` |
| 1922 | order datetime label | `Thời gian đặt hàng` |
| 1946 | order checkbox label | `Có ngày cần giao` |
| 1951 | order datetime label | `Ngày cần giao` |
| 1971 | order submit button texts | `createOrder.isPending ? "Đang lưu" : "Lưu đơn đặt hàng"` |
| 1975 | return-side aria label | `Thông tin trả hàng` |
| 2012 | linked-return fallback customer/invoice block | `Chưa chọn hóa đơn nguồn` |
| 2013 | linked-return fallback subtitle | `Nhập mã hóa đơn nguồn` |
| 2032 | return datetime label | `Thời gian trả hàng` |
| 2046 | handling mode label | `Cách xử lý` |
| 2056 | handling option | `Hoàn tiền ngay` |
| 2058 | handling option | `Trừ công nợ` |
| 2068 | return summary label | `Tổng tiền trả` |
| 2076 | return submit button texts | `createReturn.isPending ? "Đang trả hàng" : "Trả hàng"` |
| 2079 | returns link text | `Xem danh sách trả hàng` |

## 2. Additional source files that still contain mojibake

These files still matched mojibake markers during the scan:

- `frontend/src/features/customers/CustomerDetailPage.tsx`
- `frontend/src/features/customers/CustomerEditPage.tsx`
- `frontend/src/features/customers/CustomerInlineDetailPanel.tsx`
- `frontend/src/features/history/HistoryDetailDrawer.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/historyPresentation.ts`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/features/orders/OrderListPage.tsx`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoiceEditPage.tsx`
- `frontend/src/features/sales/InvoicePages.test.tsx`

## 3. Notes from the repo scan

- `docs/CUSTOMER_VIETNAMESE_TEXT_MANUAL_REPAIR.md` already documents many customer-file mojibake cases, but those source files still currently contain mojibake.
- The scan also hits dependency/cache files under `.venv/` and `.uv-cache/`; I ignored those because they are not project source.
- `InvoiceCreatePage.tsx` is currently the worst source file because it contains both:
  - extreme string corruption like `AAaAa...`
  - plain ASCII fallback corruption such as `BAn hAng`, `Tha lai`, `Quay lai`

## 4. Recommended next step

Repair `InvoiceCreatePage.tsx` first using the grouped replacements above, then run the same manual-repair pass on the remaining source files listed in section 2.
